import Notification from "../models/notification.model.js";
import Appointment from "../models/appointment.model.js";
import IntegrationSettings from "../models/integrationSettings.model.js";
import { sendAppointmentEmail } from "./email.service.js";
import { syncAppointmentToGoogleCalendar } from "./google-calendar.service.js";

export async function createNotification({
  userId,
  appointmentId,
  type,
  title,
  message,
  emailSent = false,
}) {
  if (!userId || !appointmentId) return null;

  const notification = await Notification.create({
    user: userId,
    appointment: appointmentId,
    type,
    title,
    message,
    emailSent,
  });

  return notification;
}

export async function getNotificationsForUser({
  userId,
  unreadOnly = false,
  page = 1,
  limit = 10,
}) {
  const filter = { user: userId };
  if (unreadOnly) filter.isRead = false;

  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Notification.countDocuments(filter);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getUnreadNotificationCount(userId) {
  return Notification.countDocuments({ user: userId, isRead: false });
}

export async function markNotificationRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true },
  );
}

export async function markAllNotificationsRead(userId) {
  return Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true },
  );
}

export async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, user: userId });
}

export async function createAppointmentNotifications({
  appointment,
  type,
  message,
  title,
}) {
  if (!appointment) return null;

  if (
    [
      "booking_pending",
      "booking_confirmed",
      "cancelled",
      "rescheduled",
      "booking_expired",
    ].includes(type)
  ) {
    try {
      await syncAppointmentToGoogleCalendar(appointment);
    } catch (error) {
      console.error("Failed to sync appointment to Google Calendar:", error.message);
    }
  }

  const notification = appointment.customer
    ? await createNotification({
        userId: appointment.customer?._id || appointment.customer,
        appointmentId: appointment._id,
        type,
        title,
        message,
      })
    : null;

  const settings = await IntegrationSettings.findOne({
    key: "default",
  }).lean();
  if (settings?.emailNotifications !== false && type !== "reminder") {
    const emailSent = await sendAppointmentEmail({
      appointment,
      title,
      message,
    });
    if (notification) {
      notification.emailSent = emailSent;
      await notification.save();
    }
  }
  return notification;
}

export async function createStaffAssignmentNotification({
  appointment,
  staffId,
  serviceName,
}) {
  if (!appointment || !staffId) return null;

  return createNotification({
    userId: staffId._id || staffId,
    appointmentId: appointment._id,
    type: "booking_assigned",
    title: "Appointment assigned to you",
    message: `You have been assigned a ${serviceName || "salon service"} appointment on ${new Date(appointment.date).toISOString().slice(0, 10)} at ${appointment.startTime}.`,
  });
}

export async function createStaffAppointmentReminderNotification({
  appointment,
  reminderType,
}) {
  if (!appointment?.staff || !appointment?._id) return null;

  const isDue = reminderType === "staff_due";
  const customerName =
    appointment.customer?.name || appointment.walkInCustomer?.name || "your client";

  return createNotification({
    userId: appointment.staff?._id || appointment.staff,
    appointmentId: appointment._id,
    type: "reminder",
    title: isDue ? "Appointment time" : "Appointment in 5 minutes",
    message: isDue
      ? `${customerName}'s ${appointment.service?.name || "appointment"} starts now at ${appointment.startTime}.`
      : `${customerName}'s ${appointment.service?.name || "appointment"} starts in 5 minutes at ${appointment.startTime}.`,
  });
}

export async function syncReminderState(appointmentId, reminderType) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) return null;

  const existing = appointment.remindersSent || [];
  if (!existing.includes(reminderType)) {
    appointment.remindersSent = [...existing, reminderType];
    await appointment.save();
  }

  return appointment;
}
