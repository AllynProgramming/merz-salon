import { Router } from "express";

import {
  assignAppointmentStaff,
  cancelStaffAppointment,
  confirmAppointment,
  createStaffAppointment,
  createReminderTestAppointments,
  getAvailability,
  getAvailabilityCalendar,
  getStaffAppointment,
  listAppointments,
  rescheduleStaffAppointment,
  searchBookingCustomers,
} from "../controllers/appointment.controller.js";
import {
  protect,
  requirePasswordChangeComplete,
  requireAdmin,
  requireStaffOrAdmin,
} from "../middlewares/auth.middleware.js";
import {
  appointmentDetailSchema,
  appointmentQuerySchema,
  availabilityCalendarSchema,
  availabilitySchema,
  createStaffAppointmentSchema,
  rescheduleSchema,
  staffAssignmentSchema,
  staffCustomerSearchSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/appointment.middleware.js";

const router = Router();

router.use(protect, requireStaffOrAdmin, requirePasswordChangeComplete);
router.get(
  "/availability/calendar",
  validateQuery(availabilityCalendarSchema),
  getAvailabilityCalendar,
);
router.get("/availability", validateQuery(availabilitySchema), getAvailability);
router.get(
  "/customers",
  validateQuery(staffCustomerSearchSchema),
  searchBookingCustomers,
);
router.get("/", validateQuery(appointmentQuerySchema), listAppointments);
router.post(
  "/",
  validateBody(createStaffAppointmentSchema),
  createStaffAppointment,
);
router.post("/test-reminders", createReminderTestAppointments);
router.get("/:id", validateParams(appointmentDetailSchema), getStaffAppointment);
router.patch(
  "/:id/cancel",
  validateParams(appointmentDetailSchema),
  cancelStaffAppointment,
);
router.patch(
  "/:id/reschedule",
  validateParams(appointmentDetailSchema),
  validateBody(rescheduleSchema),
  rescheduleStaffAppointment,
);
router.patch(
  "/:id/assign",
  requireAdmin,
  validateParams(appointmentDetailSchema),
  validateBody(staffAssignmentSchema),
  assignAppointmentStaff,
);
router.patch(
  "/:id/confirm",
  validateParams(appointmentDetailSchema),
  confirmAppointment,
);

export default router;
