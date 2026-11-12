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
import {
  feedbackSchema,
  feedbackParamsSchema,
  feedbackUpdateSchema,
  validateBody,
  validateParams,
} from "../middlewares/feedback.middleware.js";

const router = Router();

router.get("/admin", protect, requireAdmin, getAdminFeedback);
router.use(protect, requireCustomer);
router.post("/", validateBody(feedbackSchema), createFeedback);
router.get("/mine", getMyFeedback);
router.get(
  "/appointments/:id",
  validateParams(feedbackParamsSchema),
  getFeedbackForAppointment,
);
router.put(
  "/:id",
  validateParams(feedbackParamsSchema),
  validateBody(feedbackUpdateSchema),
  updateFeedback,
);

export default router;
