import { Router } from "express";

import {
  assignAppointmentStaff,
  confirmAppointment,
  listAppointments,
} from "../controllers/appointment.controller.js";
import {
  protect,
  requireAdmin,
  requireStaffOrAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireStaffOrAdmin);
router.get("/", listAppointments);
router.patch("/:id/assign", requireAdmin, assignAppointmentStaff);
router.patch("/:id/confirm", confirmAppointment);

export default router;
