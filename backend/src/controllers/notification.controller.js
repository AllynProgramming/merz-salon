
import {
  deleteNotification,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service.js";

export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const data = await getNotificationsForUser({
      userId: req.user.id,
      unreadOnly: Boolean(unreadOnly),
      page,
      limit,
    });

    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

export const getNotificationCount = async (req, res, next) => {
  try {
    const count = await getUnreadNotificationCount(req.user.id);
    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json({
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user.id);
    return res
      .status(200)
      .json({ message: "All notifications marked as read." });
  } catch (error) {
    return next(error);
  }
};

export const removeNotification = async (req, res, next) => {
  try {
    const notification = await deleteNotification(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json({ message: "Notification removed." });
  } catch (error) {
    return next(error);
  }
};
