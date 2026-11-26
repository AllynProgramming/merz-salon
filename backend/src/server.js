import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "dotenv";

import connectDB from "./db/database.js";
import v1Routes from "./routes/v1.routes.js";
import { startReminderJob } from "./jobs/reminderJob.js";

config();

const app = express();
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
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

app.use("/api/v1", v1Routes);

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
