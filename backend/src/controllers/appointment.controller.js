import { z } from "zod";

import Appointment from "../models/appointment.model.js";
import Feedback from "../models/feedback.model.js";
import Service from "../models/service.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";
import { salonSchedule } from "../config/schedule.js";
import { changeAppointmentStatus } from "../utils/appointmentStatus.js";
import {
  createAppointmentNotifications,
  syncReminderState,
} from "../services/notification.service.js";

const isValidDateOnly = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const objectIdPattern = /^[a-f\d]{24}$/i;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const appointmentStatuses = Object.values(APPOINTMENT_STATUS);

const appointmentQuerySchema = z
  .object({
    type: z.enum(["upcoming", "past", "all"]).optional(),
    status: z.enum(appointmentStatuses).optional(),
    from: z
      .string()
      .refine(isValidDateOnly, "Use a valid date in YYYY-MM-DD format")
      .optional(),
    to: z
      .string()
      .refine(isValidDateOnly, "Use a valid date in YYYY-MM-DD format")
      .optional(),
    search: z.string().trim().max(120).optional(),
    sort: z.enum(["date_asc", "date_desc"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()
  .refine(
    (filters) => !filters.from || !filters.to || filters.from <= filters.to,
    {
      message: "The end date must be on or after the start date.",
      path: ["to"],
    },
  );

const appointmentDetailSchema = z
  .object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid appointment id."),
  })
  .strict();
const staffAssignmentSchema = z
  .object({
    staffId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Choose a valid staff member.")
      .nullable(),
  })
  .strict();

const availabilitySchema = z
  .object({
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    excludeAppointmentId: z.string().regex(objectIdPattern).optional(),
  })
  .strict();

const createAppointmentSchema = z
  .object({
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict();

const createStaffAppointmentSchema = z
  .object({
    customerId: z.string().regex(objectIdPattern, "Choose a valid customer."),
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict();

const staffCustomerSearchSchema = z
  .object({
    search: z.string().trim().min(2).max(80),
  })
  .strict();

const rescheduleSchema = z
  .object({
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict();

const parseDate = (value) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

const parseTime = (value) => {
  const [hours, minutes] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const getSalonClock = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: salonSchedule.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const dateDifferenceInDays = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchBookingCustomers = async (req, res, next) => {
  const validation = staffCustomerSearchSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      message: "Enter at least 2 characters to search customers.",
    });
  }

  try {
    const pattern = new RegExp(escapeRegex(validation.data.search), "i");
    const customers = await User.find({
      role: "customer",
      $or: [
        { name: pattern },
        { firstname: pattern },
        { lastname: pattern },
        { email: pattern },
        { phone: pattern },
        { phoneNumber: pattern },
      ],
    })
      .select("name firstname lastname email phone phoneNumber")
      .sort({ name: 1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      customers: customers.map((customer) => ({
        _id: customer._id,
        name:
          customer.name ||
          [customer.firstname, customer.lastname].filter(Boolean).join(" "),
        email: customer.email,
        phone: customer.phone || customer.phoneNumber || "",
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const filtersForAppointmentType = (type, today, currentTime) => {
  if (type === "upcoming") {
    return [
      {
        status: {
          $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
        },
      },
      {
        $or: [
          { date: { $gt: today } },
          { date: today, startTime: { $gt: currentTime } },
        ],
      },
    ];
  }

  if (type === "past") {
    return [
      {
        $or: [
          {
            status: {
              $nin: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
            },
          },
          { date: { $lt: today } },
          { date: today, startTime: { $lte: currentTime } },
        ],
      },
    ];
  }

  return [];
};

const normalizeDateValue = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("Invalid appointment date."), {
      status: 400,
    });
  }
  return date;
};

const overlaps = (start, end, otherStart, otherEnd) =>
  start < otherEnd && otherStart < end;

const getAvailabilityForService = async ({
  serviceId,
  date,
  excludeAppointmentId = "",
}) => {
  const service = await Service.findOne({
    _id: serviceId,
    isActive: true,
  }).lean();

  if (!service) {
    throw Object.assign(new Error("Choose an available service."), {
      status: 404,
    });
  }

  const localDate = normalizeDateValue(date);
  const salonNow = getSalonClock();
  const maximumDaysAhead = Number(salonSchedule.maximumDaysAhead || 30);
  const daysFromToday = dateDifferenceInDays(salonNow.date, date);

  if (daysFromToday < 0 || daysFromToday > maximumDaysAhead) {
    return {
      date,
      slots: [],
      unavailable: true,
    };
  }

  const appointmentQuery = {
    service: serviceId,
    date: localDate,
    status: { $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
  };

  if (excludeAppointmentId) {
    appointmentQuery._id = { $ne: excludeAppointmentId };
  }

  const existingAppointments = await Appointment.find(appointmentQuery)
    .select("startTime endTime")
    .lean();

  const startMinutes = parseTime(salonSchedule.openingTime);
  const endMinutes = parseTime(salonSchedule.closingTime);
  const duration = Number(service.durationMinutes || 60);
  const interval = Number(salonSchedule.slotIntervalMinutes || 30);
  const noticeMinutes = Number(salonSchedule.minimumNoticeHours || 2) * 60;
  const noticeClock = getSalonClock(
    new Date(Date.now() + noticeMinutes * 60 * 1000),
  );
  const slots = [];

  for (
    let start = startMinutes;
    start + duration <= endMinutes;
    start += interval
  ) {
    const end = start + duration;
    const slotIsAfterNotice =
      date > noticeClock.date ||
      (date === noticeClock.date && start >= noticeClock.minutes);
    const collision = existingAppointments.some((appointment) =>
      overlaps(
        start,
        end,
        parseTime(appointment.startTime),
        parseTime(appointment.endTime),
      ),
    );
    const dayIsClosed = salonSchedule.closedWeekdays.includes(
      localDate.getUTCDay(),
    );
    const reason = dayIsClosed
      ? "Closed"
      : !slotIsAfterNotice
        ? "Minimum notice required"
        : collision
          ? "Booked"
          : "";

    slots.push({
      startTime: formatTime(start),
      endTime: formatTime(end),
      available: !reason,
      ...(reason ? { reason } : {}),
    });
  }

  return { date, slots };
};

const ensureSlotIsAvailable = async ({
  serviceId,
  date,
  startTime,
  excludeAppointmentId = "",
}) => {
  const availability = await getAvailabilityForService({
    serviceId,
    date,
    excludeAppointmentId,
  });

  const slot = availability.slots.find(
    (entry) => entry.startTime === startTime,
  );
  if (!slot || !slot.available) {
    throw Object.assign(new Error("That time is no longer available."), {
      status: 409,
    });
  }

  return slot;
};

export const listAppointments = async (req, res, next) => {
  const validation = appointmentQuerySchema.safeParse(req.query);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return res.status(400).json({
      message: issue?.message || "Invalid appointment filter values.",
    });
  }

  try {
    const {
      type = "all",
      status,
      from,
      to,
      search,
      sort,
      page = 1,
      limit = 10,
    } = validation.data;
    const isStaffView = ["staff", "admin"].includes(req.user.role);
    const filters = isStaffView ? [] : [{ customer: req.user.id }];

    if (status) {
      filters.push({ status });
    }

    if (from || to) {
      const dateFilter = {};
      if (from) dateFilter.$gte = parseDate(from);
      if (to) dateFilter.$lte = parseDate(to);
      filters.push({ date: dateFilter });
    }

    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), "i");
      const matchingServices = await Service.find({ name: searchPattern })
        .select("_id")
        .lean();
      filters.push({
        $or: [
          { bookingReference: searchPattern },
          { service: { $in: matchingServices.map((service) => service._id) } },
        ],
      });
    }

    const salonNow = getSalonClock();
    const today = normalizeDateValue(salonNow.date);
    const currentTime = formatTime(salonNow.minutes);
    const commonFilters = [...filters];
    filters.push(...filtersForAppointmentType(type, today, currentTime));

    const filter = { $and: filters };
    const effectiveSort =
      sort || (type === "upcoming" ? "date_asc" : "date_desc");
    const query = Appointment.find(filter)
      .populate("service", "name price durationMinutes")
      .populate("staff", "name firstname lastname")
      .sort(
        effectiveSort === "date_asc"
          ? { date: 1, startTime: 1 }
          : { date: -1, startTime: -1 },
      );
    if (isStaffView) {
      query.populate("customer", "name firstname lastname");
    }
    query.lean();

    const [
      total,
      allCount,
      upcomingCount,
      pastCount,
      statusCountValues,
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ $and: commonFilters }),
      Appointment.countDocuments({
        $and: [
          ...commonFilters,
          ...filtersForAppointmentType("upcoming", today, currentTime),
        ],
      }),
      Appointment.countDocuments({
        $and: [
          ...commonFilters,
          ...filtersForAppointmentType("past", today, currentTime),
        ],
      }),
      Promise.all(
        Object.values(APPOINTMENT_STATUS).map((appointmentStatus) =>
          Appointment.countDocuments({
            $and: [
              ...commonFilters.filter(
                (commonFilter) => !Object.hasOwn(commonFilter, "status"),
              ),
              { status: appointmentStatus },
            ],
          }),
        ),
      ),
    ]);
    const statusCounts = Object.fromEntries(
      Object.values(APPOINTMENT_STATUS).map((appointmentStatus, index) => [
        appointmentStatus,
        statusCountValues[index],
      ]),
    );
    const offset = (page - 1) * limit;
    const items = await query.skip(offset).limit(limit);

    const appointmentIds = items.map((item) => item._id);
    const feedbackMap = new Map();
    const feedbackRows = await Feedback.find({
      customer: req.user.id,
      appointment: { $in: appointmentIds },
    })
      .select("appointment rating")
      .lean();

    for (const row of feedbackRows) {
      feedbackMap.set(String(row.appointment), row);
    }

    const mappedItems = items.map((appointment) => {
      const feedback = feedbackMap.get(String(appointment._id));
      return {
        _id: appointment._id,
        ...(isStaffView && {
          customerId: String(appointment.customer?._id || appointment.customer),
          customerName:
            appointment.customer?.name ||
            [appointment.customer?.firstname, appointment.customer?.lastname]
              .filter(Boolean)
              .join(" ") ||
            "Customer",
        }),
        ...(isStaffView && {
          staffId: appointment.staff?._id
            ? String(appointment.staff._id)
            : null,
          staffName:
            appointment.staff?.name ||
            [appointment.staff?.firstname, appointment.staff?.lastname]
            .filter(Boolean)
            .join(" ") ||
            null,
        }),
        service: appointment.service
          ? { _id: appointment.service._id, name: appointment.service.name }
          : null,
        serviceName:
          appointment.serviceName ||
          appointment.service?.name ||
          "Salon service",
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        price: appointment.priceSnapshot ?? appointment.service?.price ?? 0,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
        canReschedule: [
          APPOINTMENT_STATUS.PENDING,
          APPOINTMENT_STATUS.CONFIRMED,
        ].includes(appointment.status),
        canCancel: [
          APPOINTMENT_STATUS.PENDING,
          APPOINTMENT_STATUS.CONFIRMED,
        ].includes(appointment.status),
        hasFeedback: Boolean(feedback),
        rating: feedback?.rating ?? null,
      };
    });

    return res.status(200).json({
      items: mappedItems,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: { all: allCount, upcoming: upcomingCount, past: pastCount },
      statusCounts,
    });
  } catch (error) {
    return next(error);
  }
};

export const assignAppointmentStaff = async (req, res, next) => {
  const idValidation = appointmentDetailSchema.safeParse({ id: req.params.id });
  const bodyValidation = staffAssignmentSchema.safeParse(req.body);
  if (!idValidation.success || !bodyValidation.success) {
    return res.status(400).json({
      message:
        bodyValidation.error?.issues[0]?.message || "Invalid staff assignment.",
    });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }
    if (
      ![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      return res.status(400).json({
        message: "Only pending or confirmed appointments can be assigned.",
      });
    }

    const { staffId } = bodyValidation.data;
    if (!staffId) {
      appointment.staff = null;
      await appointment.save();
      return res.status(200).json({
        message: "Staff member removed from appointment.",
        staffId: null,
        staffName: null,
      });
    }

    const staff = await User.findOne({
      _id: staffId,
      role: "staff",
    }).select("name firstname lastname workingHours");
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    const weekday = appointment.date.getUTCDay();
    const workday = staff.workingHours?.find(
      (hours) => hours.weekday === weekday,
    );
    if (!workday || !workday.enabled) {
      return res.status(409).json({
        message: "This staff member is not scheduled to work on that day.",
      });
    }
    if (
      appointment.startTime < workday.startTime ||
      appointment.endTime > workday.endTime
    ) {
      return res.status(409).json({
        message: "The appointment falls outside this staff member’s working hours.",
      });
    }

    const overlappingAppointment = await Appointment.exists({
      _id: { $ne: appointment._id },
      staff: staff._id,
      date: appointment.date,
      status: {
        $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
      },
      startTime: { $lt: appointment.endTime },
      endTime: { $gt: appointment.startTime },
    });
    if (overlappingAppointment) {
      return res.status(409).json({
        message: "This staff member already has an appointment at that time.",
      });
    }

    appointment.staff = staff._id;
    await appointment.save();
    const staffName =
      staff.name ||
      [staff.firstname, staff.lastname].filter(Boolean).join(" ") ||
      "Staff member";
    return res.status(200).json({
      message: "Staff member assigned.",
      staffId: String(staff._id),
      staffName,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAppointmentById = async (req, res, next) => {
  const validation = appointmentDetailSchema.safeParse({ id: req.params.id });
  if (!validation.success) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user.id,
    })
      .populate("service", "name price durationMinutes")
      .lean();

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    const feedback = await Feedback.findOne({
      appointment: appointment._id,
      customer: req.user.id,
    }).lean();

    const canReschedule = [
      APPOINTMENT_STATUS.PENDING,
      APPOINTMENT_STATUS.CONFIRMED,
    ].includes(appointment.status);
    const canCancel = [
      APPOINTMENT_STATUS.PENDING,
      APPOINTMENT_STATUS.CONFIRMED,
    ].includes(appointment.status);
    const canReview =
      appointment.status === APPOINTMENT_STATUS.COMPLETED && !feedback;
    const configuredEditDays = Number.parseInt(
      process.env.FEEDBACK_EDIT_DAYS || "7",
      10,
    );
    const editWindowDays =
      Number.isInteger(configuredEditDays) && configuredEditDays > 0
        ? configuredEditDays
        : 7;
    const canEditFeedback = Boolean(
      feedback &&
      Date.now() - new Date(feedback.createdAt).getTime() <=
        editWindowDays * 24 * 60 * 60 * 1000,
    );

    return res.status(200).json({
      appointment: {
        _id: appointment._id,
        service: appointment.service
          ? {
              _id: appointment.service._id,
              name: appointment.service.name,
              price: appointment.service.price,
              durationMinutes: appointment.service.durationMinutes,
            }
          : null,
        serviceName:
          appointment.serviceName ||
          appointment.service?.name ||
          "Salon service",
        servicePrice:
          appointment.priceSnapshot ?? appointment.service?.price ?? 0,
        durationMinutes:
          appointment.durationMinutes ??
          appointment.service?.durationMinutes ??
          0,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
        statusHistory: appointment.statusHistory || [],
        canReschedule,
        canCancel,
        canReview,
        canEditFeedback,
        canRescheduleReason: canReschedule
          ? ""
          : "This appointment can no longer be rescheduled.",
        canCancelReason: canCancel
          ? ""
          : "This appointment can no longer be changed.",
        canReviewReason: canReview
          ? ""
          : feedback
            ? "Feedback has already been submitted for this appointment."
            : appointment.status === APPOINTMENT_STATUS.COMPLETED
              ? "This appointment cannot be reviewed."
              : "Feedback is available after a completed appointment.",
        canEditFeedbackReason: canEditFeedback
          ? ""
          : feedback
            ? "The feedback editing period has ended."
            : "No feedback has been submitted yet.",
        feedback: feedback
          ? {
              _id: feedback._id,
              rating: feedback.rating,
              comment: feedback.comment,
              createdAt: feedback.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getAvailability = async (req, res, next) => {
  const validation = availabilitySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid availability request.",
    });
  }

  try {
    const { serviceId, date, excludeAppointmentId } = validation.data;
    const availability = await getAvailabilityForService({
      serviceId,
      date,
      excludeAppointmentId,
    });

    return res.status(200).json(availability);
  } catch (error) {
    return next(error);
  }
};

export const createStaffAppointment = async (req, res, next) => {
  const validation = createStaffAppointmentSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid appointment details.",
    });
  }

  try {
    const { customerId, serviceId, date, startTime } = validation.data;
    const [customer, service] = await Promise.all([
      User.findOne({ _id: customerId, role: "customer" }).select("_id"),
      Service.findOne({ _id: serviceId, isActive: true }),
    ]);

    if (!customer) {
      return res.status(404).json({ message: "Customer account not found." });
    }
    if (!service) {
      return res.status(404).json({ message: "Choose an available service." });
    }

    const appointmentDate = normalizeDateValue(date);
    const endTime = formatTime(
      parseTime(startTime) + Number(service.durationMinutes || 60),
    );
    await ensureSlotIsAvailable({ serviceId, date, startTime });

    const bookingReference = `MERZ-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const appointment = new Appointment({
      customer: customer._id,
      service: service._id,
      date: appointmentDate,
      bookingReference,
      startTime,
      endTime,
      priceSnapshot: Number(service.price),
      durationMinutes: Number(service.durationMinutes),
      status: APPOINTMENT_STATUS.PENDING,
    });
    appointment.statusHistory.push({
      status: APPOINTMENT_STATUS.PENDING,
      changedBy: String(req.user.id),
      note: "Salon staff booked this appointment for the customer.",
      changedAt: new Date(),
    });
    await appointment.save();

    await createAppointmentNotifications({
      appointment,
      type: "booking_pending",
      title: "Appointment booked by salon staff",
      message: `Your ${service.name} appointment for ${date} at ${startTime} is waiting for staff confirmation.`,
    });

    return res.status(201).json({
      message: "Appointment booked for the customer.",
      appointment: {
        _id: appointment._id,
        service: { _id: service._id, name: service.name },
        serviceName: service.name,
        servicePrice: service.price,
        durationMinutes: service.durationMinutes,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  const validation = createAppointmentSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid appointment details.",
    });
  }

  try {
    const { serviceId, date, startTime } = validation.data;
    const service = await Service.findOne({ _id: serviceId, isActive: true });
    if (!service) {
      return res.status(404).json({ message: "Choose an available service." });
    }

    const appointmentDate = normalizeDateValue(date);
    const appointmentStartMinutes = parseTime(startTime);
    const endMinutes =
      appointmentStartMinutes + Number(service.durationMinutes || 60);
    const endTime = formatTime(endMinutes);

    const slot = await ensureSlotIsAvailable({
      serviceId,
      date,
      startTime,
    });

    const bookingReference = `MERZ-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const appointment = new Appointment({
      customer: req.user.id,
      service: service._id,
      date: appointmentDate,
      bookingReference,
      startTime,
      endTime,
      priceSnapshot: Number(service.price),
      durationMinutes: Number(service.durationMinutes),
      status: APPOINTMENT_STATUS.PENDING,
    });
    appointment.statusHistory.push({
      status: APPOINTMENT_STATUS.PENDING,
      changedBy: "customer",
      note: "Customer requested an appointment.",
      changedAt: new Date(),
    });
    await appointment.save();

    await createAppointmentNotifications({
      appointment,
      type: "booking_pending",
      title: "Appointment request received",
      message: `Your ${service.name} appointment request for ${date} at ${startTime} is waiting for staff confirmation.`,
    });

    return res.status(201).json({
      message: "Appointment request submitted.",
      appointment: {
        _id: appointment._id,
        service: { _id: service._id, name: service.name },
        serviceName: service.name,
        servicePrice: service.price,
        durationMinutes: service.durationMinutes,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
        statusHistory: appointment.statusHistory,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmAppointment = async (req, res, next) => {
  const validation = appointmentDetailSchema.safeParse({ id: req.params.id });
  if (!validation.success) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  try {
    const appointment = await Appointment.findById(req.params.id).populate(
      "service",
      "name",
    );
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      return res.status(400).json({
        message: "Only pending appointments can be confirmed.",
      });
    }

    if (req.user.role === "staff") {
      if (
        appointment.staff &&
        String(appointment.staff) !== String(req.user.id)
      ) {
        return res.status(409).json({
          message: "This appointment is assigned to another staff member.",
        });
      }
      const workday = req.user.workingHours?.find(
        (hours) => hours.weekday === appointment.date.getUTCDay(),
      );
      if (
        !workday?.enabled ||
        appointment.startTime < workday.startTime ||
        appointment.endTime > workday.endTime
      ) {
        return res.status(409).json({
          message: "You are not scheduled to work during this appointment.",
        });
      }
      const overlappingAppointment = await Appointment.exists({
        _id: { $ne: appointment._id },
        staff: req.user.id,
        date: appointment.date,
        status: {
          $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
        },
        startTime: { $lt: appointment.endTime },
        endTime: { $gt: appointment.startTime },
      });
      if (overlappingAppointment) {
        return res.status(409).json({
          message: "You already have an appointment at that time.",
        });
      }
    }

    changeAppointmentStatus(appointment, APPOINTMENT_STATUS.CONFIRMED, {
      changedBy: String(req.user.id),
      note: "Staff confirmed the appointment.",
    });
    if (req.user.role === "staff") appointment.staff = req.user.id;
    await appointment.save();

    await createAppointmentNotifications({
      appointment,
      type: "booking_confirmed",
      title: "Appointment confirmed",
      message: `Your ${appointment.service?.name || "appointment"} on ${appointment.date.toISOString().slice(0, 10)} at ${appointment.startTime} has been confirmed.`,
    });

    return res.status(200).json({
      message: "Appointment confirmed.",
      appointment: {
        _id: appointment._id,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
        statusHistory: appointment.statusHistory,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const rescheduleAppointment = async (req, res, next) => {
  const validation = appointmentDetailSchema.safeParse({ id: req.params.id });
  if (!validation.success) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  const bodyValidation = rescheduleSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    return res.status(400).json({
      message:
        bodyValidation.error.issues[0]?.message ||
        "Invalid reschedule request.",
    });
  }

  try {
    const { date, startTime } = bodyValidation.data;
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user.id,
    }).populate("service", "name durationMinutes price");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (
      ![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      return res.status(400).json({
        message: "This appointment can no longer be rescheduled.",
      });
    }

    if (
      appointment.date.toISOString().slice(0, 10) === date &&
      appointment.startTime === startTime
    ) {
      return res
        .status(400)
        .json({ message: "Choose a different date or time." });
    }

    await ensureSlotIsAvailable({
      serviceId: String(appointment.service._id),
      date,
      startTime,
      excludeAppointmentId: appointment._id,
    });

    const nextEndTime = formatTime(
      parseTime(startTime) + Number(appointment.service.durationMinutes || 60),
    );
    appointment.date = normalizeDateValue(date);
    appointment.startTime = startTime;
    appointment.endTime = nextEndTime;
    changeAppointmentStatus(appointment, appointment.status, {
      changedBy: "customer",
      note: "Appointment time was rescheduled.",
      allowSameStatus: true,
    });
    await appointment.save();

    await createAppointmentNotifications({
      appointment,
      type: "rescheduled",
      title: "Appointment updated",
      message: `Your ${appointment.service.name} appointment has been rescheduled to ${date} at ${startTime}.`,
    });

    return res.status(200).json({
      message: "Appointment rescheduled.",
      appointment: {
        _id: appointment._id,
        serviceName: appointment.service.name,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const rescheduleStaffAppointment = async (req, res, next) => {
  const validation = appointmentDetailSchema.safeParse({ id: req.params.id });
  if (!validation.success) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  const bodyValidation = rescheduleSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    return res.status(400).json({
      message:
        bodyValidation.error.issues[0]?.message ||
        "Invalid reschedule request.",
    });
  }

  try {
    const { date, startTime } = bodyValidation.data;
    const appointment = await Appointment.findById(req.params.id).populate(
      "service",
      "name durationMinutes price",
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (
      ![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      return res.status(400).json({
        message: "This appointment can no longer be rescheduled.",
      });
    }

    if (
      appointment.date.toISOString().slice(0, 10) === date &&
      appointment.startTime === startTime
    ) {
      return res
        .status(400)
        .json({ message: "Choose a different date or time." });
    }

    if (!appointment.service) {
      return res.status(409).json({
        message: "The service for this appointment is no longer available.",
      });
    }

    await ensureSlotIsAvailable({
      serviceId: String(appointment.service._id),
      date,
      startTime,
      excludeAppointmentId: appointment._id,
    });

    appointment.date = normalizeDateValue(date);
    appointment.startTime = startTime;
    appointment.endTime = formatTime(
      parseTime(startTime) +
        Number(appointment.service.durationMinutes || 60),
    );
    changeAppointmentStatus(appointment, appointment.status, {
      changedBy: String(req.user.id),
      note: "Salon staff rescheduled the appointment.",
      allowSameStatus: true,
    });
    await appointment.save();

    await createAppointmentNotifications({
      appointment,
      type: "rescheduled",
      title: "Appointment updated",
      message: `Your ${appointment.service.name} appointment has been rescheduled to ${date} at ${startTime}.`,
    });

    return res.status(200).json({
      message: "Appointment rescheduled.",
      appointment: {
        _id: appointment._id,
        serviceName: appointment.service.name,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        bookingReference: appointment.bookingReference,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  const validation = appointmentDetailSchema.safeParse({ id: req.params.id });
  if (!validation.success) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user.id,
    }).populate("service", "name");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (
      ![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      return res.status(400).json({
        message: "This appointment can no longer be cancelled.",
      });
    }

    const updatedAppointment = changeAppointmentStatus(
      appointment,
      APPOINTMENT_STATUS.CANCELLED,
      {
        changedBy: "customer",
        note: "Customer cancelled the appointment.",
      },
    );
    await updatedAppointment.save();

    await createAppointmentNotifications({
      appointment: updatedAppointment,
      type: "cancelled",
      title: "Appointment cancelled",
      message: `Your ${updatedAppointment.service?.name || "appointment"} booking has been cancelled.`,
    });

    return res.status(200).json({
      message: "Appointment cancelled.",
      appointment: {
        _id: updatedAppointment._id,
        status: updatedAppointment.status,
        cancelledAt: updatedAppointment.cancelledAt,
        bookingReference: updatedAppointment.bookingReference,
      },
    });
  } catch (error) {
    return next(error);
  }
};
