import { Router } from "express";

import {
  changeCustomerPassword,
  getCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customer.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireCustomer);
router.get("/me", getCustomerProfile);
router.put("/me", updateCustomerProfile);
router.put("/me/password", changeCustomerPassword);

export default router;
