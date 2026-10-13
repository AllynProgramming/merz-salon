import { Router } from "express";

import {
  createFeedback,
  getAdminFeedback,
  getFeedbackForAppointment,
  getMyFeedback,
  updateFeedback,
} from "../controllers/feedback.controller.js";
import {
  protect,
  requireAdmin,
  requireCustomer,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/admin", protect, requireAdmin, getAdminFeedback);
router.use(protect, requireCustomer);
router.post("/", createFeedback);
router.get("/mine", getMyFeedback);
router.get("/appointments/:id", getFeedbackForAppointment);
router.put("/:id", updateFeedback);

export default router;
