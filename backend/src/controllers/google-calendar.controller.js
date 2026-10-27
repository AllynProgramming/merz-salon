import jwt from "jsonwebtoken";

import IntegrationSettings from "../models/integrationSettings.model.js";
import User from "../models/user.model.js";
import { encryptSecret, getIntegrationSecrets } from "../utils/integrationSecrets.js";

const getGoogleConfig = async () => {
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  return {
    clientId: secrets.googleClientId || process.env.GOOGLE_CLIENT_ID,
    clientSecret: secrets.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      secrets.googleCalendarRedirectUri ||
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      "http://localhost:3000/api/admin/calendar/callback",
  };
};

const frontendUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

export const connectGoogleCalendar = async (req, res, next) => {
  try {
    const config = await getGoogleConfig();
    if (!config.clientId || !config.clientSecret) {
      return res.redirect(`${frontendUrl()}/admin/settings?calendar_error=not_configured`);
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
      scope: "https://www.googleapis.com/auth/calendar.events openid email",
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
    const decoded = jwt.verify(req.query.state, process.env.JWT_SECRET);
    if (decoded.purpose !== "google-calendar") throw new Error("Invalid OAuth state.");
    const admin = await User.findById(decoded.id).select("role");
    if (!admin || admin.role !== "admin") throw new Error("Admin access is required.");

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
      throw new Error(tokenPayload.error_description || "Google did not return a refresh token.");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    const profile = await profileResponse.json();
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
    return res.redirect(`${frontendUrl()}/admin/settings?calendar_connected=true`);
  } catch (error) {
    console.error("Google Calendar OAuth callback failed:", error.message);
    return res.redirect(`${frontendUrl()}/admin/settings?calendar_error=connection_failed`);
  }
};
