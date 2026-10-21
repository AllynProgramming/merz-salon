import { Router } from "express";

import {
  assignAppointmentStaff,
  confirmAppointment,
  createStaffAppointment,
  getAvailability,
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
router.get("/availability", getAvailability);
router.get("/customers", searchBookingCustomers);
router.get("/", listAppointments);
router.post("/", createStaffAppointment);
router.patch("/:id/reschedule", rescheduleStaffAppointment);
router.patch("/:id/assign", requireAdmin, assignAppointmentStaff);
router.patch("/:id/confirm", confirmAppointment);

export default router;
