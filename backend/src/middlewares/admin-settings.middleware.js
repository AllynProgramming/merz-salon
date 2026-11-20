import { z } from "zod";

const optionalUrl = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
    );

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
    googleOauthRedirectUri: optionalUrl(500).optional(),
    calendarId: z.string().trim().max(254).optional(),
    calendarEmbedUrl: optionalUrl(1000).optional(),
    googleCalendarRedirectUri: optionalUrl(500).optional(),
    smtpHost: z.string().trim().max(254).optional(),
    smtpPort: z.string().trim().max(10).optional(),
    smtpUser: z.string().trim().max(254).optional(),
    smtpPass: z.string().max(500).optional(),
    smtpFrom: z.string().trim().email().max(254).optional(),
    recaptchaSecretKey: z.string().max(500).optional(),
    resetCredentials: z.boolean().optional(),
  })
  .strict();

export { settingsSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
