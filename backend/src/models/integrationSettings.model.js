import mongoose from "mongoose";

const integrationSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    emailNotifications: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true },
    googleCalendar: { type: Boolean, default: false },
    googleLogin: { type: Boolean, default: false },
    embeddedMaps: { type: Boolean, default: true },
    recaptchaRequired: { type: Boolean, default: false },
    googleClientId: { type: String, default: "" },
    googleClientSecret: { type: String, default: "" },
    googleOauthRedirectUri: { type: String, default: "" },
    googleCalendarRedirectUri: { type: String, default: "" },
    calendarRefreshToken: { type: String, default: "" },
    calendarId: { type: String, default: "primary" },
    calendarEmbedUrl: { type: String, default: "" },
    calendarEmail: { type: String, default: "" },
    smtpHost: { type: String, default: "" },
    smtpPort: { type: String, default: "" },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "" },
    smtpFrom: { type: String, default: "" },
    recaptchaSecretKey: { type: String, default: "" },
  },
  { timestamps: true },
);

const IntegrationSettings =
  mongoose.models.IntegrationSettings ||
  mongoose.model("IntegrationSettings", integrationSettingsSchema);

export default IntegrationSettings;
