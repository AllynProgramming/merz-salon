import { Router } from "express";

import {
  changeCustomerPassword,
  getCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customer.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/me", protect, getCustomerProfile);
router.use(protect, requireCustomer);
router.put("/me", updateCustomerProfile);
router.put("/me/password", changeCustomerPassword);

export default router;
