import { Router } from "express";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/profile.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import {
  validateBody,
  profileUpdateSchema,
  passwordChangeSchema,
} from "../middlewares/profile.middleware.js";

const router = Router();

router.use(protect, requireCustomer);

router.get("/profile", getProfile);
router.put("/profile", validateBody(profileUpdateSchema, { message: "Invalid profile data" }), updateProfile);
router.put("/change-password", validateBody(passwordChangeSchema, { message: "Invalid password data" }), changePassword);

export default router;
