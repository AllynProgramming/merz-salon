import { z } from "zod";



const settingsSchema = z
  .object({
    emailNotifications: z.boolean(),
    appointmentReminders: z.boolean(),
    googleCalendar: z.boolean(),
    googleDrive: z.boolean(),
    pdfReports: z.boolean(),
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
    resetCredentials: z.boolean().optional(),
  })
  .strict();

export { settingsSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
