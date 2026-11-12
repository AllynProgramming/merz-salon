import { Router } from "express";

import {
  downloadAdminReport,
  getAdminReport,
  uploadAdminReport,
} from "../controllers/admin-report.controller.js";
import {
  connectGoogleDrive,
  getGoogleDriveStatus,
  googleDriveCallback,
} from "../controllers/google-drive.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, requireAdmin, getAdminReport);
router.get("/pdf", protect, requireAdmin, downloadAdminReport);
router.post("/drive/upload", protect, requireAdmin, uploadAdminReport);
router.get("/drive/status", protect, requireAdmin, getGoogleDriveStatus);
router.get("/drive/connect", protect, requireAdmin, connectGoogleDrive);
router.get("/drive/callback", googleDriveCallback);

export default router;
