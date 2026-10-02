import { Router } from "express";

import {
  getNotificationCount,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeNotification,
} from "../controllers/notification.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireCustomer);
router.get("/", getNotifications);
router.get("/unread-count", getNotificationCount);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);
router.delete("/:id", removeNotification);

export default router;
