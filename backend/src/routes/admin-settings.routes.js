import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  readIntegrationSettings,
  updateIntegrationSettings,
} from "../controllers/admin-settings.controller.js";
import {
  requestSettingsAccess,
  verifySettingsAccess,
} from "../controllers/admin-settings-access.controller.js";
import {
  connectGoogleDrive,
  googleDriveCallback,
} from "../controllers/google-drive.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";
import { requireAdminSettingsAccess } from "../middlewares/admin-settings-access.middleware.js";

const router = Router();
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many settings verification attempts. Try again later." },
});

router.get("/drive/callback", googleDriveCallback);
router.use(protect, requireAdmin);
router.post("/access/request", accessLimiter, requestSettingsAccess);
router.post("/access/verify", accessLimiter, verifySettingsAccess);
router.use(requireAdminSettingsAccess);
router.get("/drive/connect", connectGoogleDrive);
router.get("/", readIntegrationSettings);
router.put("/", updateIntegrationSettings);

export default router;
