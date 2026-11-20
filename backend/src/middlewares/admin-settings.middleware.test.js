import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsSchema } from "./admin-settings.middleware.js";

const validSettings = {
  emailNotifications: true,
  appointmentReminders: true,
  googleCalendar: false,
  googleDrive: false,
  pdfReports: true,
  googleLogin: false,
  embeddedMaps: true,
  recaptchaRequired: false,
};

test("accepts an empty optional calendar embed URL during settings saves", () => {
  const result = settingsSchema.safeParse({
    ...validSettings,
    calendarEmbedUrl: "",
  });

  assert.equal(result.success, true);
});

test("continues rejecting malformed non-empty optional URLs", () => {
  const result = settingsSchema.safeParse({
    ...validSettings,
    calendarEmbedUrl: "not a URL",
  });

  assert.equal(result.success, false);
});
