import jwt from "jsonwebtoken";

import IntegrationSettings from "../models/integrationSettings.model.js";
import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import {
  encryptSecret,
  getIntegrationSecrets,
} from "../utils/integrationSecrets.js";
import {
  listGoogleCalendarEvents,
  syncAppointmentToGoogleCalendar,
} from "../services/google-calendar.service.js";

const getGoogleConfig = async () => {
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  const environmentCredentials =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      : null;
  return {
    clientId: environmentCredentials?.clientId || secrets.googleClientId,
    clientSecret:
      environmentCredentials?.clientSecret || secrets.googleClientSecret,
    redirectUri:
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      secrets.googleCalendarRedirectUri ||
      "http://localhost:3000/api/admin/calendar/callback",
  };
};

const frontendUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

const calendarErrorRedirect = (code) =>
  `${frontendUrl()}/admin/settings?calendar_error=${encodeURIComponent(code)}`;

const configureCalendarTimezone = async (accessToken, calendarId) => {
  const normalizedCalendarId =
    calendarId && calendarId !== "CALENDAR_ID" ? calendarId : "primary";
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(normalizedCalendarId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `******`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeZone: process.env.SALON_TIMEZONE || "Asia/Manila",
      }),
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error?.message || "Google Calendar timezone could not be updated.",
    );
  }
};

export const connectGoogleCalendar = async (req, res, next) => {
  try {
    const config = await getGoogleConfig();
    if (!config.clientId || !config.clientSecret) {
      return res.redirect(
        `${frontendUrl()}/admin/settings?calendar_error=not_configured`,
      );
    }

    const state = jwt.sign(
      { id: String(req.user._id), purpose: "google-calendar" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    if (req.headers.accept?.includes("application/json")) {
      return res.status(200).json({ authorizationUrl });
    }
    return res.redirect(authorizationUrl);
  } catch (error) {
    return next(error);
  }
};

export const googleCalendarCallback = async (req, res) => {
  try {
    if (req.query.error) {
      throw new Error(`Google authorization was denied: ${req.query.error}`);
    }
    if (!req.query.code || !req.query.state) {
      throw new Error("Google did not return the authorization code.");
    }
    const decoded = jwt.verify(req.query.state, process.env.JWT_SECRET);
    if (decoded.purpose !== "google-calendar")
      throw new Error("Invalid OAuth state.");
    const admin = await User.findById(decoded.id).select("role");
    if (!admin || admin.role !== "admin")
      throw new Error("Admin access is required.");

    const config = await getGoogleConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.refresh_token) {
      throw new Error(
        tokenPayload.error_description ||
          tokenPayload.error ||
          "Google did not return a refresh token.",
      );
    }

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      },
    );
    if (!profileResponse.ok) {
      throw new Error("Google account details could not be loaded.");
    }
    const profile = await profileResponse.json();
    const existingSettings = await IntegrationSettings.findOne({
      key: "default",
    })
      .select("calendarId")
      .lean();
    try {
      await configureCalendarTimezone(
        tokenPayload.access_token,
        existingSettings?.calendarId,
      );
    } catch (error) {
      console.warn(
        "Google Calendar connected, but the calendar timezone could not be updated:",
        error.message,
      );
    }
    await IntegrationSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          googleCalendar: true,
          calendarRefreshToken: encryptSecret(tokenPayload.refresh_token),
          calendarEmail: profile.email || "",
        },
      },
      { upsert: true },
    );
    return res.redirect(
      `${frontendUrl()}/admin/settings?calendar_connected=true`,
    );
  } catch (error) {
    console.error("Google Calendar OAuth callback failed:", error.message);
    const code = error.message.startsWith("Google authorization was denied")
      ? "authorization_denied"
      : error.message.includes("redirect_uri")
        ? "redirect_uri_mismatch"
        : /invalid_client|invalid_grant/.test(error.message)
          ? "oauth_credentials_rejected"
          : error.message.includes("timezone")
            ? "timezone_update_failed"
            : error.message.includes("refresh token")
              ? "refresh_token_missing"
              : "connection_failed";
    return res.redirect(calendarErrorRedirect(code));
  }
};

export const getGoogleCalendarEvents = async (req, res, next) => {
  try {
    const timeMin = new Date(req.query.timeMin).toISOString();
    const timeMax = new Date(req.query.timeMax).toISOString();
    if (timeMin >= timeMax) {
      return res.status(400).json({ message: "Calendar range is invalid." });
    }

    const appointments = await Appointment.find({
      date: { $gte: new Date(timeMin), $lt: new Date(timeMax) },
    })
      .populate("customer", "name email")
      .populate("service", "name")
      .populate("staff", "name email")
      .lean();

    await Promise.all(
      appointments.map(async (appointment) => {
        try {
          await syncAppointmentToGoogleCalendar(appointment);
        } catch (error) {
          console.error(
            `Failed to backfill Google Calendar event for appointment ${appointment._id}:`,
            error.message,
          );
        }
      }),
    );

    const calendar = await listGoogleCalendarEvents({ timeMin, timeMax });
    return res.status(200).json(calendar);
  } catch (error) {
    return next(error);
  }
};
