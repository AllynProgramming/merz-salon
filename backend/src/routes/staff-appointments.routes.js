import { Router } from "express";

import { confirmAppointment } from "../controllers/appointment.controller.js";
import {
  protect,
  requireStaffOrAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireStaffOrAdmin);
router.patch("/:id/confirm", confirmAppointment);

export default router;
