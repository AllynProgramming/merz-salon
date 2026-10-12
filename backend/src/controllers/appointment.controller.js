import { z } from "zod";

import Appointment from "../models/appointment.model.js";
import Feedback from "../models/feedback.model.js";
import Service from "../models/service.model.js";
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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(today);
  lastDate.setDate(
    lastDate.getDate() + Number(salonSchedule.maximumDaysAhead || 30),
  );

  if (localDate < today || localDate > lastDate) {
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
  const slots = [];

  for (
    let start = startMinutes;
    start + duration <= endMinutes;
    start += interval
  ) {
    const end = start + duration;
    const slotDateTime = new Date(`${date}T${formatTime(start)}:00Z`);
    const now = new Date();
    const afterNotice =
      slotDateTime.getTime() >=
      now.getTime() +
        Number(salonSchedule.minimumNoticeHours || 2) * 60 * 60 * 1000;
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
      : !afterNotice
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

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const commonFilters = [...filters];
    filters.push(...filtersForAppointmentType(type, today, currentTime));

    const filter = { $and: filters };
    const effectiveSort =
      sort || (type === "upcoming" ? "date_asc" : "date_desc");
    const query = Appointment.find(filter)
      .populate("service", "name price durationMinutes")
      .sort(
        effectiveSort === "date_asc"
          ? { date: 1, startTime: 1 }
          : { date: -1, startTime: -1 },
      )
      .lean();

    const [total, allCount, upcomingCount, pastCount] = await Promise.all([
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
    ]);
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

    changeAppointmentStatus(appointment, APPOINTMENT_STATUS.CONFIRMED, {
      changedBy: String(req.user.id),
      note: "Staff confirmed the appointment.",
    });
    appointment.staff = req.user.id;
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
