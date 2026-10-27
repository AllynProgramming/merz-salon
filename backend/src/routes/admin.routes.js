import { Router } from "express";
import {
  createStaff,
  listStaff,
  updateStaff,
  updateStaffWorkingHours,
} from "../controllers/admin-staff.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireAdmin);
router.get("/staff", listStaff);
router.post("/staff", createStaff);
router.put("/staff/:id", updateStaff);
router.put("/staff/:id/working-hours", updateStaffWorkingHours);

export default router;
