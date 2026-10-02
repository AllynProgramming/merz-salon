import { Router } from "express";

import {
  createFeedback,
  getFeedbackForAppointment,
  getMyFeedback,
  updateFeedback,
} from "../controllers/feedback.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireCustomer);
router.post("/", createFeedback);
router.get("/mine", getMyFeedback);
router.get("/appointments/:id", getFeedbackForAppointment);
router.put("/:id", updateFeedback);

export default router;
