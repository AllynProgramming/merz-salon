import {
  ALLOWED_STATUS_TRANSITIONS,
  APPOINTMENT_STATUS,
} from "../constants/appointmentStatus.js";

export function assertAppointmentTransition(currentStatus, nextStatus) {
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    throw Object.assign(new Error("Invalid appointment status transition."), {
      status: 400,
    });
  }

  return nextStatus;
}

export function buildStatusHistoryEntry({
  status,
  changedBy = "system",
  note = "",
}) {
  return {
    status,
    changedBy,
    note,
    changedAt: new Date().toISOString(),
  };
}

export function changeAppointmentStatus(appointment, nextStatus, options = {}) {
  const { changedBy = "system", note = "", allowSameStatus = false } = options;

  const currentStatus = appointment.status || APPOINTMENT_STATUS.PENDING;
  if (!(allowSameStatus && currentStatus === nextStatus)) {
    assertAppointmentTransition(currentStatus, nextStatus);
  }

  if (!Array.isArray(appointment.statusHistory)) {
    appointment.statusHistory = [];
  }

  appointment.status = nextStatus;
  appointment.statusHistory.push(
    buildStatusHistoryEntry({ status: nextStatus, changedBy, note }),
  );

  if (nextStatus === APPOINTMENT_STATUS.CANCELLED) {
    appointment.cancelledAt = new Date();
  }

  return appointment;
}
