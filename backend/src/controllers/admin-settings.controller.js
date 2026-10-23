import { z } from "zod";

import IntegrationSettings from "../models/integrationSettings.model.js";

const settingsSchema = z
  .object({
    emailNotifications: z.boolean(),
    appointmentReminders: z.boolean(),
    googleCalendar: z.boolean(),
    googleLogin: z.boolean(),
  })
  .strict();

const settingsFields = [
  "emailNotifications",
  "appointmentReminders",
  "googleCalendar",
  "googleLogin",
];

const getSettings = async () =>
  IntegrationSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

const publicSettings = (settings) =>
  Object.fromEntries(settingsFields.map((field) => [field, settings[field]]));

export const readIntegrationSettings = async (req, res, next) => {
  try {
    return res.status(200).json({ settings: publicSettings(await getSettings()) });
  } catch (error) {
    return next(error);
  }
};

export const updateIntegrationSettings = async (req, res, next) => {
  const validation = settingsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: validation.error.issues[0]?.message || "Invalid integration settings.",
    });
  }

  try {
    const settings = await IntegrationSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: validation.data,
        $unset: {
          smsNotifications: 1,
          whatsappNotifications: 1,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
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
