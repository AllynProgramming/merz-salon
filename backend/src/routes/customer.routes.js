import { Router } from "express";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/profile.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireCustomer);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

export default router;
