import { Router } from "express";

import {
  getNotificationCount,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeNotification,
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  notificationIdSchema,
  paginationSchema,
  validateParams,
  validateQuery,
} from "../middlewares/notification.middleware.js";

const router = Router();

router.use(protect);
router.get("/", validateQuery(paginationSchema), getNotifications);
router.get("/unread-count", getNotificationCount);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch(
  "/:id/read",
  validateParams(notificationIdSchema),
  markNotificationAsRead,
);
router.delete("/:id", validateParams(notificationIdSchema), removeNotification);

export default router;
