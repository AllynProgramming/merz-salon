import { Router } from "express";
import {
  createStaff,
  listStaff,
  updateStaff,
  updateStaffWorkingHours,
} from "../controllers/admin-staff.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  createStaffSchema,
  staffParamsSchema,
  updateStaffSchema,
  validateBody,
  validateParams,
  workingHoursSchema,
} from "../middlewares/admin-staff.middleware.js";

const router = Router();

router.use(protect, requireAdmin);
router.get("/staff", listStaff);
router.post("/staff", validateBody(createStaffSchema), createStaff);
router.put(
  "/staff/:id",
  validateParams(staffParamsSchema),
  validateBody(updateStaffSchema),
  updateStaff,
);
router.put(
  "/staff/:id/working-hours",
  validateParams(staffParamsSchema),
  validateBody(workingHoursSchema),
  updateStaffWorkingHours,
);

export default router;
