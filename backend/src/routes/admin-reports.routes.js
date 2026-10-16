import { Router } from "express";

import { getAdminReport } from "../controllers/admin-report.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, requireAdmin, getAdminReport);

export default router;
