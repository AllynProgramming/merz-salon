import { Router } from "express";

import {
  connectGoogleCalendar,
  getGoogleCalendarEvents,
  googleCalendarCallback,
} from "../controllers/google-calendar.controller.js";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/events", (req, res, next) =>
  protect(req, res, () =>
    requireAdmin(req, res, () => getGoogleCalendarEvents(req, res, next)),
  ),
);

router.get("/connect", (req, res, next) => {
  if (req.query.code && req.query.state) {
    return googleCalendarCallback(req, res);
  }
  return protect(req, res, () =>
    requireAdmin(req, res, () => connectGoogleCalendar(req, res, next)),
  );
});
router.get("/callback", googleCalendarCallback);

export default router;
