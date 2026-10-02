import { z } from "zod";

import {
  deleteNotification,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service.js";

const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    unreadOnly: z
      .preprocess((value) => value === "true" || value === true, z.boolean())
      .optional(),
  })
  .strict();

export const getNotifications = async (req, res, next) => {
  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid notification filters.",
    });
  }

  try {
    const { page, limit, unreadOnly } = validation.data;
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
