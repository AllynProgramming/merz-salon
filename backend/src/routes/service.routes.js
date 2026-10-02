import { Router } from "express";

import {
  getServiceById,
  getServices,
} from "../controllers/service.controller.js";

const router = Router();

router.get("/", getServices);
router.get("/:id", getServiceById);

export default router;
