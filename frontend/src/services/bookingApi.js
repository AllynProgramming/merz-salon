import { bookingSchedule } from "../config/bookingSchedule.js";

const USE_MOCK_APPOINTMENT_API =
  import.meta.env.VITE_USE_MOCK_APPOINTMENT_API !== "false";

const MOCK_APPOINTMENTS_KEY = "merz.booking.mock-appointments";
const mockAppointments = new Map(
  (() => {
    try {
      return JSON.parse(sessionStorage.getItem(MOCK_APPOINTMENTS_KEY) || "[]");
    } catch {
      return [];
    }
  })(),
);
let cachedServices = [];

function persistMockAppointments() {
  sessionStorage.setItem(
    MOCK_APPOINTMENTS_KEY,
    JSON.stringify([...mockAppointments.entries()]),
  );
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.message || "The request could not be completed.",
    );
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
}

async function request(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && token) {
    window.dispatchEvent(new Event("merz:session-expired"));
  }
  return readJson(response);
}

const delay = (milliseconds = 220) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const dateParts = (value) => String(value).slice(0, 10).split("-").map(Number);
const toLocalDate = (value) => {
  const [year, month, day] = dateParts(value);
  return new Date(year, month - 1, day);
};
const toMinutes = (value) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const overlaps = (start, end, otherStart, otherEnd) =>
  start < otherEnd && otherStart < end;

function getMockService(serviceId) {
  const service = cachedServices.find((item) => item._id === serviceId);
  if (!service) {
    const error = new Error("Choose an available service.");
    error.status = 404;
    throw error;
  }
  return service;
}

function makeMockAvailability({ serviceId, date, excludeAppointmentId }) {
  const service = getMockService(serviceId);
  const localDate = toLocalDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + bookingSchedule.maximumDaysAhead);
  const isClosed = bookingSchedule.closedWeekdays.includes(localDate.getDay());
  const isOutOfRange = localDate < today || localDate > lastDate;
  const opening = toMinutes(bookingSchedule.openingTime);
  const closing = toMinutes(bookingSchedule.closingTime);
  const duration = Number(service.durationMinutes);
  const slots = [];

  for (
    let start = opening;
    start + duration <= closing;
    start += bookingSchedule.slotIntervalMinutes
  ) {
    const end = start + duration;
    const now = new Date();
    const slotDateTime = new Date(localDate);
    slotDateTime.setHours(Math.floor(start / 60), start % 60, 0, 0);
    const afterNotice =
      slotDateTime.getTime() >=
      now.getTime() + bookingSchedule.minimumNoticeHours * 60 * 60 * 1000;

    const collision = [...mockAppointments.values()].some((appointment) => {
      if (appointment._id === excludeAppointmentId) return false;
      if (
        appointment.date !== date ||
        !["pending", "confirmed"].includes(appointment.status)
      ) {
        return false;
      }
      return overlaps(
        start,
        end,
        toMinutes(appointment.startTime),
        toMinutes(appointment.endTime),
      );
    });

    const reason = isClosed
      ? "Closed"
      : isOutOfRange
        ? "Outside booking window"
        : !afterNotice
          ? "Minimum notice required"
          : collision
            ? "Booked"
            : "";
    slots.push({
      startTime: toTime(start),
      endTime: toTime(end),
      available: !reason,
      ...(reason ? { reason } : {}),
    });
  }

  return { date, slots };
}

function appointmentPermissions(appointment) {
  const canChange = ["pending", "confirmed"].includes(appointment.status);
  const start = new Date(`${appointment.date}T${appointment.startTime}:00`);
  const outsideNotice =
    start.getTime() >=
    Date.now() + bookingSchedule.minimumNoticeHours * 60 * 60 * 1000;
  const canAct = canChange && outsideNotice;
  const feedbackCreatedAt = appointment.feedback?.createdAt
    ? new Date(appointment.feedback.createdAt).getTime()
    : 0;
  const canEditFeedback =
    Boolean(appointment.feedback) &&
    Date.now() - feedbackCreatedAt <= 7 * 24 * 60 * 60 * 1000;
  return {
    ...appointment,
    canReschedule: canAct,
    canCancel: canAct,
    canReview: appointment.status === "completed" && !appointment.feedback,
    canEditFeedback,
    canEditFeedbackReason: canEditFeedback
      ? ""
      : appointment.feedback
        ? "The feedback editing period has ended."
        : "No feedback has been submitted yet.",
    cancelReason:
      canChange && !outsideNotice
        ? `Changes close ${bookingSchedule.minimumNoticeHours} hours before your appointment.`
        : canChange
          ? ""
          : "This appointment can no longer be changed.",
  };
}

function mockError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getServices({ category = "", search = "", limit } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (search.trim()) params.set("search", search.trim());
  if (limit) params.set("limit", String(limit));
  const suffix = params.size ? `?${params}` : "";
  const payload = await request(`/api/services${suffix}`);
  const services = Array.isArray(payload) ? payload : payload.services || [];
  cachedServices = services;
  return services;
}

export async function getService(serviceId) {
  const payload = await request(
    `/api/services/${encodeURIComponent(serviceId)}`,
  );
  return payload.service || payload;
}

export async function getAvailability({
  serviceId,
  date,
  excludeAppointmentId = "",
  token,
}) {
  if (!USE_MOCK_APPOINTMENT_API) {
    const params = new URLSearchParams({ serviceId, date });
    if (excludeAppointmentId)
      params.set("excludeAppointmentId", excludeAppointmentId);
    return request(`/api/appointments/availability?${params}`, { token });
  }

  await delay();
  return makeMockAvailability({ serviceId, date, excludeAppointmentId });
}

export async function createAppointment({ serviceId, date, startTime, token }) {
  if (!USE_MOCK_APPOINTMENT_API) {
    return request("/api/appointments", {
      method: "POST",
      token,
      body: JSON.stringify({ serviceId, date, startTime }),
    });
  }

  await delay(320);
  const availability = makeMockAvailability({ serviceId, date });
  const slot = availability.slots.find((item) => item.startTime === startTime);
  if (!slot?.available) {
    throw mockError(
      "That time was just taken. Please choose another slot.",
      409,
    );
  }

  const service = getMockService(serviceId);
  const appointment = {
    _id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    service: { _id: service._id, name: service.name },
    serviceName: service.name,
    servicePrice: service.price,
    durationMinutes: service.durationMinutes,
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: "confirmed",
    bookingReference: `MERZ-${Date.now().toString().slice(-8)}`,
    statusHistory: [
      {
        status: "confirmed",
        changedAt: new Date().toISOString(),
        note: "Customer booked the appointment.",
      },
    ],
    owner: token,
  };
  mockAppointments.set(appointment._id, appointment);
  persistMockAppointments();
  return appointment;
}

export async function getAppointment(appointmentId, token) {
  if (!USE_MOCK_APPOINTMENT_API) {
    const payload = await request(
      `/api/appointments/${encodeURIComponent(appointmentId)}`,
      { token },
    );
    return payload.appointment || payload;
  }

  await delay();
  const appointment = mockAppointments.get(appointmentId);
  if (!appointment || appointment.owner !== token) {
    throw mockError("Appointment not found.", 404);
  }
  return appointmentPermissions({ ...appointment });
}

export async function rescheduleAppointment(
  appointmentId,
  { date, startTime, token },
) {
  if (!USE_MOCK_APPOINTMENT_API) {
    const payload = await request(
      `/api/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      {
        method: "PUT",
        token,
        body: JSON.stringify({ date, startTime }),
      },
    );
    return payload.appointment || payload;
  }

  await delay(320);
  const appointment = mockAppointments.get(appointmentId);
  if (!appointment || appointment.owner !== token) {
    throw mockError("Appointment not found.", 404);
  }
  if (!appointmentPermissions(appointment).canReschedule) {
    throw mockError(appointmentPermissions(appointment).cancelReason, 400);
  }
  if (appointment.date === date && appointment.startTime === startTime) {
    throw mockError("Choose a different date or time.", 400);
  }

  const availability = makeMockAvailability({
    serviceId: appointment.service._id,
    date,
    excludeAppointmentId: appointmentId,
  });
  const slot = availability.slots.find((item) => item.startTime === startTime);
  if (!slot?.available) {
    throw mockError(
      "That time was just taken. Please choose another slot.",
      409,
    );
  }

  appointment.rescheduledFrom = {
    date: appointment.date,
    startTime: appointment.startTime,
  };
  appointment.date = date;
  appointment.startTime = slot.startTime;
  appointment.endTime = slot.endTime;
  appointment.statusHistory = [
    ...(appointment.statusHistory || []),
    {
      status: appointment.status,
      changedAt: new Date().toISOString(),
      note: "Appointment time was rescheduled.",
    },
  ];
  mockAppointments.set(appointmentId, appointment);
  persistMockAppointments();
  return appointmentPermissions({ ...appointment });
}

export async function cancelAppointment(appointmentId, token) {
  if (!USE_MOCK_APPOINTMENT_API) {
    const payload = await request(
      `/api/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      {
        method: "PATCH",
        token,
      },
    );
    return payload.appointment || payload;
  }

  await delay(280);
  const appointment = mockAppointments.get(appointmentId);
  if (!appointment || appointment.owner !== token) {
    throw mockError("Appointment not found.", 404);
  }
  if (!appointmentPermissions(appointment).canCancel) {
    throw mockError(appointmentPermissions(appointment).cancelReason, 400);
  }
  appointment.status = "cancelled";
  appointment.cancelledAt = new Date().toISOString();
  appointment.statusHistory = [
    ...(appointment.statusHistory || []),
    {
      status: appointment.status,
      changedAt: appointment.cancelledAt,
      note: "Customer cancelled the appointment.",
    },
  ];
  mockAppointments.set(appointmentId, appointment);
  persistMockAppointments();
  return appointmentPermissions({ ...appointment });
}

export async function getAppointments({
  token,
  type = "all",
  status,
  search = "",
  from = "",
  to = "",
  sort,
  page = 1,
  limit = 10,
} = {}) {
  if (!USE_MOCK_APPOINTMENT_API) {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (status && status !== "all") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sort) params.set("sort", sort);
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
    const suffix = params.size ? `?${params}` : "";
    return request(`/api/appointments${suffix}`, { token });
  }

  await delay();
  const customerAppointments = [...mockAppointments.values()].filter(
    (appointment) => appointment.owner === token,
  );
  const commonItems = customerAppointments.filter((appointment) => {
    const matchesStatus =
      !status || status === "all" || appointment.status === status;
    const matchesSearch =
      !search.trim() ||
      `${appointment.serviceName || ""} ${appointment.bookingReference || appointment._id}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    const appointmentDate = String(appointment.date).slice(0, 10);
    return (
      matchesStatus &&
      matchesSearch &&
      (!from || appointmentDate >= from) &&
      (!to || appointmentDate <= to)
    );
  });
  const isUpcoming = (appointment) =>
    ["pending", "confirmed"].includes(appointment.status) &&
    new Date(`${appointment.date}T${appointment.startTime}:00`) > new Date();
  const filtered = commonItems.filter(
    (appointment) =>
      type === "all" ||
      (type === "upcoming" && isUpcoming(appointment)) ||
      (type === "past" && !isUpcoming(appointment)),
  );
  const sortOrder = sort || (type === "upcoming" ? "date_asc" : "date_desc");
  const sortDirection = sortOrder === "date_asc" ? 1 : -1;
  const items = filtered
    .sort(
      (first, second) =>
        sortDirection *
        `${first.date} ${first.startTime}`.localeCompare(
          `${second.date} ${second.startTime}`,
        ),
    )
    .slice((page - 1) * limit, page * limit)
    .map((appointment) => ({
      _id: appointment._id,
      service: appointment.service,
      serviceName: appointment.serviceName,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      price: appointment.servicePrice ?? 0,
      status: appointment.status,
      bookingReference: appointment.bookingReference || appointment._id,
      canReschedule: appointmentPermissions(appointment).canReschedule,
      canCancel: appointmentPermissions(appointment).canCancel,
      hasFeedback: Boolean(appointment.feedback),
      rating: appointment.feedback?.rating ?? null,
    }));

  return {
    items,
    page,
    limit,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    counts: {
      all: commonItems.length,
      upcoming: commonItems.filter(isUpcoming).length,
      past: commonItems.filter((appointment) => !isUpcoming(appointment))
        .length,
    },
  };
}

export async function updateAppointmentFeedback({
  feedbackId,
  rating,
  comment,
  token,
}) {
  if (!USE_MOCK_APPOINTMENT_API) {
    return request(`/api/feedback/${encodeURIComponent(feedbackId)}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ rating, comment }),
    });
  }

  const appointment = [...mockAppointments.values()].find(
    (entry) => entry.feedback?._id === feedbackId && entry.owner === token,
  );
  if (!appointment) throw mockError("Feedback not found.", 404);
  const createdAt = new Date(appointment.feedback.createdAt).getTime();
  if (Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
    throw mockError("This feedback can no longer be edited.", 403);
  }

  appointment.feedback = {
    ...appointment.feedback,
    rating,
    comment: String(comment || "").trim(),
  };
  mockAppointments.set(appointment._id, appointment);
  persistMockAppointments();
  return { message: "Feedback updated.", feedback: appointment.feedback };
}

export async function submitAppointmentFeedback({
  appointmentId,
  rating,
  comment,
  token,
}) {
  if (!USE_MOCK_APPOINTMENT_API) {
    return request("/api/feedback", {
      method: "POST",
      token,
      body: JSON.stringify({ appointmentId, rating, comment }),
    });
  }

  const appointment = [...mockAppointments.values()].find(
    (entry) => entry._id === appointmentId,
  );
  if (!appointment || appointment.owner !== token) {
    throw mockError("Appointment not found.", 404);
  }
  if (appointment.status !== "completed") {
    throw mockError(
      "Feedback can only be left after a completed appointment.",
      403,
    );
  }

  const feedback = {
    _id: `mock-feedback-${Date.now()}`,
    appointment: appointmentId,
    rating,
    comment: String(comment || "").trim(),
    createdAt: new Date().toISOString(),
  };

  appointment.feedback = feedback;
  mockAppointments.set(appointmentId, appointment);
  persistMockAppointments();

  return { message: "Thank you for your feedback.", feedback };
}

export async function getDashboardOverview(token) {
  if (!USE_MOCK_APPOINTMENT_API) {
    return request("/api/dashboard", { token });
  }

  await delay();
  const customerAppointments = [...mockAppointments.values()].filter(
    (appointment) => appointment.owner === token,
  );
  const statuses = ["pending", "confirmed", "completed", "cancelled"];
  const counts = Object.fromEntries(
    statuses.map((status) => [
      status,
      customerAppointments.filter(
        (appointment) => appointment.status === status,
      ).length,
    ]),
  );
  counts.total = customerAppointments.length;

  const now = new Date();
  const upcomingAppointments = customerAppointments
    .filter((appointment) => {
      if (!["pending", "confirmed"].includes(appointment.status)) return false;
      const [year, month, day] = dateParts(appointment.date);
      const [hours, minutes] = appointment.startTime.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes) > now;
    })
    .sort((first, second) =>
      `${first.date} ${first.startTime}`.localeCompare(
        `${second.date} ${second.startTime}`,
      ),
    )
    .slice(0, 5)
    .map((appointment) => {
      const publicAppointment = { ...appointment };
      delete publicAppointment.owner;
      return publicAppointment;
    });

  counts.upcoming = customerAppointments.filter((appointment) => {
    if (!["pending", "confirmed"].includes(appointment.status)) return false;
    const [year, month, day] = dateParts(appointment.date);
    const [hours, minutes] = appointment.startTime.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes) > now;
  }).length;

  return {
    upcomingAppointments,
    nextAppointment: upcomingAppointments[0] || null,
    counts,
  };
}
