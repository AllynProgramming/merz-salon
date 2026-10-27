import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

const getKey = () => {
  const source = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) {
    throw new Error("SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required");
  }
  return crypto.createHash("sha256").update(source).digest();
};

export const encryptSecret = (value) => {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
};

export const decryptSecret = (value) => {
  if (!value) return "";
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored integration secret is invalid");
  }
  const decipher = crypto.createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

export const getIntegrationSecrets = async (IntegrationSettings) => {
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  if (!settings) return {};
  return Object.fromEntries(
    [
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
    ].map((field) => [field, decryptSecret(settings[field])]),
  );
};
