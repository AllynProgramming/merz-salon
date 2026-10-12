import { Router } from "express";

import {
  confirmAppointment,
  listAppointments,
} from "../controllers/appointment.controller.js";
import {
  protect,
  requireStaffOrAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireStaffOrAdmin);
router.get("/", listAppointments);
router.patch("/:id/confirm", confirmAppointment);

export default router;
