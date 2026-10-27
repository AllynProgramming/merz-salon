import { Router } from "express";

import { readPublicIntegrationSettings } from "../controllers/admin-settings.controller.js";

const router = Router();

router.get("/integrations", readPublicIntegrationSettings);

export default router;
