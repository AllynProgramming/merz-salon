import { Router } from "express";

import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAvailability,
  getAvailabilityCalendar,
  listAppointments,
  rescheduleAppointment,
} from "../controllers/appointment.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import { getFeedbackForAppointment } from "../controllers/feedback.controller.js";

const router = Router();

router.use(protect, requireCustomer);
router.get("/availability/calendar", getAvailabilityCalendar);
router.get("/availability", getAvailability);
router.get("/", listAppointments);
router.post("/", createAppointment);
router.get("/:id/feedback", getFeedbackForAppointment);
router.get("/:id", getAppointmentById);
router.put("/:id/reschedule", rescheduleAppointment);
router.patch("/:id/cancel", cancelAppointment);

export default router;
