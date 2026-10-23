import { Router } from "express";

import {
  readIntegrationSettings,
  updateIntegrationSettings,
} from "../controllers/admin-settings.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect, requireAdmin);
router.get("/", readIntegrationSettings);
router.put("/", updateIntegrationSettings);

export default router;
