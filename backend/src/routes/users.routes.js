import { Router } from "express";

import {
  getCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customer.controller.js";
import { changePassword } from "../controllers/profile.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/me", protect, getCustomerProfile);
router.put("/me/password", protect, changePassword);
router.use(protect, requireCustomer);
router.put("/me", updateCustomerProfile);

export default router;
