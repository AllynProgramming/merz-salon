import { Router } from "express";

import { getCustomerDashboard } from "../controllers/customer.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, requireCustomer, getCustomerDashboard);

export default router;
