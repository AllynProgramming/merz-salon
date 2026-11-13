
import IntegrationSettings from "../models/integrationSettings.model.js";
import {
  encryptSecret,
  getIntegrationSecrets,
} from "../utils/integrationSecrets.js";

const settingsFields = [
  "emailNotifications",
  "appointmentReminders",
  "googleCalendar",
  "googleDrive",
  "pdfReports",
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
  "driveRefreshToken",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "smtpFrom",
  "recaptchaSecretKey",
];

const editableSecretFields = secretFields.filter(
  (field) => !["calendarRefreshToken", "driveRefreshToken"].includes(field),
);

const getSettings = async () =>
  IntegrationSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

const publicSettings = (settings = {}, secrets = {}) => ({
  ...Object.fromEntries(
    settingsFields.map((field) => [
      field,
      field === "pdfReports" ? settings.pdfReports !== false : settings[field],
    ]),
  ),
  secretsConfigured: Object.fromEntries(
    secretFields.map((field) => [field, Boolean(settings[field])]),
  ),
  calendarConnected: Boolean(secrets.calendarRefreshToken),
  calendarEmail: settings.calendarEmail || "",
  driveConnected: Boolean(settings.driveRefreshToken),
  driveEmail: settings.driveEmail || "",
});

export const readIntegrationSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const secrets = await getIntegrationSecrets(IntegrationSettings);
    return res
      .status(200)
      .json({ settings: publicSettings(settings, secrets) });
  } catch (error) {
    return next(error);
  }
};

export const updateIntegrationSettings = async (req, res, next) => {
  try {
    const update = Object.fromEntries(
      settingsFields.map((field) => [field, req.body[field]]),
    );
    const unset = {
      smsNotifications: 1,
      whatsappNotifications: 1,
    };
    for (const field of secretFields) {
      if (req.body[field])
        update[field] = encryptSecret(req.body[field]);
    }
    if (req.body.resetCredentials) {
      for (const field of editableSecretFields) unset[field] = 1;
    }

    const settings = await IntegrationSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: update,
        $unset: unset,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).lean();
    const secrets = await getIntegrationSecrets(IntegrationSettings);
    return res.status(200).json({
      message: "Integration settings saved.",
      settings: publicSettings(settings, secrets),
    });
  } catch (error) {
    return next(error);
  }
};

export const getIntegrationSettings = getSettings;

export const readPublicIntegrationSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const configuredCalendarId =
      settings.calendarId && settings.calendarId !== "CALENDAR_ID"
        ? settings.calendarId
        : "primary";
    const calendarSource =
      settings.calendarEmail && settings.calendarEmail !== "CALENDAR_ID"
        ? settings.calendarEmail
        : configuredCalendarId;
    const savedEmbedUrl = settings.calendarEmbedUrl || "";
    const calendarEmbedUrl =
      savedEmbedUrl && !savedEmbedUrl.includes("CALENDAR_ID")
        ? savedEmbedUrl
        : `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
            calendarSource,
          )}&ctz=${encodeURIComponent(
            process.env.SALON_TIMEZONE || "Asia/Manila",
          )}`;
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
