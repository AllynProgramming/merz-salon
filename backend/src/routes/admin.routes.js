import { Router } from "express";
import {
  listStaff,
  updateStaffWorkingHours,
} from "../controllers/admin-staff.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireAdmin);
router.get("/staff", listStaff);
router.put("/staff/:id/working-hours", updateStaffWorkingHours);

export default router;
