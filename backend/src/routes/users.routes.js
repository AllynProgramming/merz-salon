import { Router } from "express";

import {
  getCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customer.controller.js";
import { changePassword } from "../controllers/profile.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import {
  validateBody,
  profileSchema,
  passwordSchema,
} from "../middlewares/customer.middleware.js";

const router = Router();

router.get("/me", protect, getCustomerProfile);
router.put(
  "/me/password",
  protect,
  validateBody(passwordSchema, {
    message: "Invalid password data",
    includeErrors: true,
  }),
  changePassword,
);
router.use(protect, requireCustomer);
router.put(
  "/me",
  validateBody(profileSchema, {
    message: "Check the highlighted profile fields.",
    includeErrors: true,
  }),
  updateCustomerProfile,
);

export default router;
