import jwt from "jsonwebtoken";

import IntegrationSettings from "../models/integrationSettings.model.js";
import User from "../models/user.model.js";
import {
  encryptSecret,
  getIntegrationSecrets,
} from "../utils/integrationSecrets.js";
import { isGoogleDriveConnected } from "../services/google-drive.service.js";

const frontendUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

const getConfig = async () => {
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  return {
    clientId: secrets.googleClientId || process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      secrets.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      process.env.GOOGLE_DRIVE_REDIRECT_URI ||
      "http://localhost:3000/api/admin/reports/drive/callback",
  };
};

export const connectGoogleDrive = async (req, res, next) => {
  try {
    const config = await getConfig();
    if (!config.clientId || !config.clientSecret) {
      return res.status(503).json({ message: "Google integration is not configured." });
    }
    const state = jwt.sign(
      { id: String(req.user._id), purpose: "google-drive" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return res.json({
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });
  } catch (error) {
    return next(error);
  }
};

export const googleDriveCallback = async (req, res) => {
  try {
    const decoded = jwt.verify(req.query.state, process.env.JWT_SECRET);
    if (decoded.purpose !== "google-drive") throw new Error("Invalid OAuth state.");
    const admin = await User.findById(decoded.id).select("role");
    if (!admin || admin.role !== "admin") throw new Error("Admin access is required.");
    const config = await getConfig();
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
          googleDrive: true,
          driveRefreshToken: encryptSecret(tokenPayload.refresh_token),
          driveEmail: profile.email || "",
        },
      },
      { upsert: true },
    );
    return res.redirect(`${frontendUrl()}/admin/reports?drive_connected=true`);
  } catch (error) {
    console.error("Google Drive OAuth callback failed:", error.message);
    return res.redirect(`${frontendUrl()}/admin/reports?drive_error=connection_failed`);
  }
};

export const getGoogleDriveStatus = async (req, res, next) => {
  try {
    return res.json({ connected: await isGoogleDriveConnected() });
  } catch (error) {
    return next(error);
  }
};
