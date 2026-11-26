import { Router } from "express";
import rateLimit from "express-rate-limit";

import authRoutes from "./auth.routes.js";
import customerRoutes from "./customer.routes.js";
import userRoutes from "./users.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import serviceRoutes from "./service.routes.js";
import appointmentRoutes from "./appointments.routes.js";
import staffAppointmentRoutes from "./staff-appointments.routes.js";
import notificationRoutes from "./notifications.routes.js";
import feedbackRoutes from "./feedback.routes.js";
import adminRoutes from "./admin.routes.js";
import adminSettingsRoutes from "./admin-settings.routes.js";
import adminReportsRoutes from "./admin-reports.routes.js";
import publicSettingsRoutes from "./public-settings.routes.js";
import adminCalendarRoutes from "./admin-calendar.routes.js";
import { googleDriveCallback } from "../controllers/google-drive.controller.js";

// Version 1 of the API, mounted at /api/v1 in server.js. A future breaking
// change gets its own v2.routes.js mounted at /api/v2 alongside this one.
const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." },
});

router.use("/auth", authLimiter, authRoutes);
router.use("/users", userRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/services", serviceRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/staff/appointments", staffAppointmentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/admin/calendar", adminCalendarRoutes);
// Google OAuth callbacks are registered before the /admin routers, which
// require an admin token: Google redirects the browser here without one.
router.get("/admin/settings/drive/callback", googleDriveCallback);
router.get("/admin/reports/drive/callback", googleDriveCallback);
router.use("/admin", adminRoutes);
router.use("/admin/settings", adminSettingsRoutes);
router.use("/admin/reports", adminReportsRoutes);
router.use("/settings", publicSettingsRoutes);
router.use("/customers", customerRoutes);

export default router;
