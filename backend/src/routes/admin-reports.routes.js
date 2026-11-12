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
import {
  querySchema,
  validateQuery,
} from "../middlewares/admin-report.middleware.js";

const router = Router();

router.get("/", protect, requireAdmin, validateQuery(querySchema), getAdminReport);
router.get("/pdf", protect, requireAdmin, validateQuery(querySchema), downloadAdminReport);
router.post("/drive/upload", protect, requireAdmin, validateQuery(querySchema), uploadAdminReport);
router.get("/drive/status", protect, requireAdmin, getGoogleDriveStatus);
router.get("/drive/connect", protect, requireAdmin, connectGoogleDrive);
router.get("/drive/callback", googleDriveCallback);

export default router;
