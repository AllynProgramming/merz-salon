import { Router } from "express";

import {
  assignAppointmentStaff,
  cancelStaffAppointment,
  confirmAppointment,
  createStaffAppointment,
  getAvailability,
  getAvailabilityCalendar,
  getStaffAppointment,
  listAppointments,
  rescheduleStaffAppointment,
  searchBookingCustomers,
} from "../controllers/appointment.controller.js";
import {
  protect,
  requireAdmin,
  requireStaffOrAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireStaffOrAdmin);
router.get("/availability/calendar", getAvailabilityCalendar);
router.get("/availability", getAvailability);
router.get("/customers", searchBookingCustomers);
router.get("/", listAppointments);
router.post("/", createStaffAppointment);
router.get("/:id", getStaffAppointment);
router.patch("/:id/cancel", cancelStaffAppointment);
router.patch("/:id/reschedule", rescheduleStaffAppointment);
router.patch("/:id/assign", requireAdmin, assignAppointmentStaff);
router.patch("/:id/confirm", confirmAppointment);

export default router;
