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
import {
  appointmentDetailSchema,
  appointmentQuerySchema,
  availabilityCalendarSchema,
  availabilitySchema,
  createAppointmentSchema,
  rescheduleSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/appointment.middleware.js";

const router = Router();

router.use(protect, requireCustomer);
router.get(
  "/availability/calendar",
  validateQuery(availabilityCalendarSchema),
  getAvailabilityCalendar,
);
router.get("/availability", validateQuery(availabilitySchema), getAvailability);
router.get("/", validateQuery(appointmentQuerySchema), listAppointments);
router.post("/", validateBody(createAppointmentSchema), createAppointment);
router.get(
  "/:id/feedback",
  validateParams(appointmentDetailSchema),
  getFeedbackForAppointment,
);
router.get("/:id", validateParams(appointmentDetailSchema), getAppointmentById);
router.put(
  "/:id/reschedule",
  validateParams(appointmentDetailSchema),
  validateBody(rescheduleSchema),
  rescheduleAppointment,
);
router.patch(
  "/:id/cancel",
  validateParams(appointmentDetailSchema),
  cancelAppointment,
);

export default router;
