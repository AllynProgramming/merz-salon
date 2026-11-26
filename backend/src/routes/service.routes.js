import { Router } from "express";

import {
  archiveService,
  createService,
  getAdminServices,
  getServiceById,
  getServices,
  listServiceLocks,
  lockService,
  restoreService,
  unlockService,
  updateService,
} from "../controllers/service.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  serviceInputSchema,
  serviceParamsSchema,
  serviceQuerySchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/service.middleware.js";

const router = Router();

router.get("/admin", protect, requireAdmin, getAdminServices);
router.get("/admin/locks", protect, requireAdmin, listServiceLocks);
router.get("/", validateQuery(serviceQuerySchema, { message: "Invalid service filters." }), getServices);
router.post("/", protect, requireAdmin, validateBody(serviceInputSchema, { includeErrors: true }), createService);
router.put("/:id", protect, requireAdmin, validateParams(serviceParamsSchema), validateBody(serviceInputSchema, { includeErrors: true }), updateService);
router.patch("/:id/archive", protect, requireAdmin, validateParams(serviceParamsSchema), archiveService);
router.patch("/:id/restore", protect, requireAdmin, validateParams(serviceParamsSchema), restoreService);
router.post("/:id/lock", protect, requireAdmin, validateParams(serviceParamsSchema), lockService);
router.delete("/:id/lock", protect, requireAdmin, validateParams(serviceParamsSchema), unlockService);
router.get("/:id", validateParams(serviceParamsSchema), getServiceById);

export default router;
