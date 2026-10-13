import { Router } from "express";

import {
  createService,
  getAdminServices,
  getServiceById,
  getServices,
  removeService,
  restoreService,
  updateService,
} from "../controllers/service.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/admin", protect, requireAdmin, getAdminServices);
router.get("/", getServices);
router.post("/", protect, requireAdmin, createService);
router.put("/:id", protect, requireAdmin, updateService);
router.delete("/:id", protect, requireAdmin, removeService);
router.patch("/:id/restore", protect, requireAdmin, restoreService);
router.get("/:id", getServiceById);

export default router;
