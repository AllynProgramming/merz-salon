import { Router } from "express";

import {
  archiveService,
  createService,
  getAdminServices,
  getServiceById,
  getServices,
  restoreService,
  updateService,
} from "../controllers/service.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/admin", protect, requireAdmin, getAdminServices);
router.get("/", getServices);
router.post("/", protect, requireAdmin, createService);
router.put("/:id", protect, requireAdmin, updateService);
router.patch("/:id/archive", protect, requireAdmin, archiveService);
router.patch("/:id/restore", protect, requireAdmin, restoreService);
router.get("/:id", getServiceById);

export default router;
