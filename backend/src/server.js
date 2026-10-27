import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";

import connectDB from "./db/database.js";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import userRoutes from "./routes/users.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import appointmentRoutes from "./routes/appointments.routes.js";
import staffAppointmentRoutes from "./routes/staff-appointments.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminSettingsRoutes from "./routes/admin-settings.routes.js";
import adminReportsRoutes from "./routes/admin-reports.routes.js";
import publicSettingsRoutes from "./routes/public-settings.routes.js";
import adminCalendarRoutes from "./routes/admin-calendar.routes.js";
import { startReminderJob } from "./jobs/reminderJob.js";

config();

const app = express();
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." },
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": [
          "'self'",
          "https://www.google.com/recaptcha/",
          "https://www.gstatic.com/recaptcha/",
        ],
        "connect-src": [
          "'self'",
          "https://www.google.com/recaptcha/",
          "https://www.gstatic.com/recaptcha/",
        ],
        "frame-src": [
          "'self'",
          "https://www.google.com/recaptcha/",
          "https://recaptcha.google.com/recaptcha/",
          "https://www.google.com/maps/",
          "https://calendar.google.com/",
        ],
        "img-src": [
          "'self'",
          "data:",
          "https://www.google.com/recaptcha/",
          "https://www.gstatic.com/recaptcha/",
        ],
        "worker-src": ["'self'", "blob:"],
      },
    },
  }),
);
app.use(express.json({ limit: "20kb" }));
app.use(cors({ origin: clientUrl, credentials: true }));

app.use("/auth", authLimiter, authRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/staff/appointments", staffAppointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin/calendar", adminCalendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/settings", publicSettingsRoutes);
app.use("/api/customers", customerRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Request failed:", error.message);
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({
    message: statusCode >= 500 ? "Internal server error" : error.message,
  });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    startReminderJob();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
