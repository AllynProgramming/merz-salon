import Notification from "../models/notification.model.js";
import Appointment from "../models/appointment.model.js";

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
  if (!appointment || !appointment.customer) return null;

  return createNotification({
    userId: appointment.customer,
    appointmentId: appointment._id,
    type,
    title,
    message,
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
