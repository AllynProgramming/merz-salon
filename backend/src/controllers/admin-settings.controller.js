import { z } from "zod";

import IntegrationSettings from "../models/integrationSettings.model.js";
import { encryptSecret } from "../utils/integrationSecrets.js";

const settingsSchema = z
  .object({
    emailNotifications: z.boolean(),
    appointmentReminders: z.boolean(),
    googleCalendar: z.boolean(),
    googleLogin: z.boolean(),
    embeddedMaps: z.boolean(),
    recaptchaRequired: z.boolean(),
    googleClientId: z.string().trim().max(254).optional(),
    googleClientSecret: z.string().max(500).optional(),
    googleOauthRedirectUri: z.string().trim().url().max(500).optional(),
    calendarId: z.string().trim().max(254).optional(),
    calendarEmbedUrl: z.string().trim().url().max(1000).optional(),
    googleCalendarRedirectUri: z.string().trim().url().max(500).optional(),
    smtpHost: z.string().trim().max(254).optional(),
    smtpPort: z.string().trim().max(10).optional(),
    smtpUser: z.string().trim().max(254).optional(),
    smtpPass: z.string().max(500).optional(),
    smtpFrom: z.string().trim().max(254).optional(),
    recaptchaSecretKey: z.string().max(500).optional(),
  })
  .strict();

const settingsFields = [
  "emailNotifications",
  "appointmentReminders",
  "googleCalendar",
  "calendarId",
  "calendarEmbedUrl",
  "googleLogin",
  "embeddedMaps",
  "recaptchaRequired",
];

const secretFields = [
  "googleClientId",
  "googleClientSecret",
  "googleOauthRedirectUri",
  "googleCalendarRedirectUri",
  "calendarRefreshToken",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "smtpFrom",
  "recaptchaSecretKey",
];

const getSettings = async () =>
  IntegrationSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

const publicSettings = (settings) => ({
  ...Object.fromEntries(
    settingsFields.map((field) => [field, settings[field]]),
  ),
  secretsConfigured: Object.fromEntries(
    secretFields.map((field) => [field, Boolean(settings[field])]),
  ),
  calendarConnected: Boolean(settings.calendarRefreshToken),
  calendarEmail: settings.calendarEmail || "",
});

export const readIntegrationSettings = async (req, res, next) => {
  try {
    return res
      .status(200)
      .json({ settings: publicSettings(await getSettings()) });
  } catch (error) {
    return next(error);
  }
};

export const updateIntegrationSettings = async (req, res, next) => {
  const validation = settingsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid integration settings.",
    });
  }

  try {
    const update = Object.fromEntries(
      settingsFields.map((field) => [field, validation.data[field]]),
    );
    for (const field of secretFields) {
      if (validation.data[field])
        update[field] = encryptSecret(validation.data[field]);
    }

    const settings = await IntegrationSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: update,
        $unset: {
          smsNotifications: 1,
          whatsappNotifications: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).lean();
    return res.status(200).json({
      message: "Integration settings saved.",
      settings: publicSettings(settings),
    });
  } catch (error) {
    return next(error);
  }
};

export const getIntegrationSettings = getSettings;

export const readPublicIntegrationSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const calendarSource = settings.calendarEmail || settings.calendarId;
    const calendarEmbedUrl =
      settings.calendarEmbedUrl ||
      (calendarSource
        ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
            calendarSource,
          )}&ctz=${encodeURIComponent(
            process.env.SALON_TIMEZONE || "Asia/Manila",
          )}`
        : "");
    return res.status(200).json({
      embeddedMaps: settings.embeddedMaps !== false,
      googleCalendar: settings.googleCalendar === true,
      calendarEmbedUrl,
      calendarEmbedConfigured: Boolean(settings.calendarEmbedUrl),
    });
  } catch (error) {
    return next(error);
  }
};
