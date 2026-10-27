import IntegrationSettings from "../models/integrationSettings.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

const fail = (res, status, message) => res.status(status).json({ message });

export const verifyRecaptcha = () => async (req, res, next) => {
  let integrationSecrets;
  try {
    integrationSecrets = await getIntegrationSecrets(IntegrationSettings);
  } catch (error) {
    console.error("Could not load encrypted integration settings:", error.message);
    return fail(res, 503, "Security settings are temporarily unavailable.");
  }
  const secret =
    integrationSecrets.recaptchaSecretKey || process.env.RECAPTCHA_SECRET_KEY;
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  const required =
    settings?.recaptchaRequired ??
    (process.env.RECAPTCHA_REQUIRED === "true" ||
      (process.env.RECAPTCHA_REQUIRED !== "false" &&
        process.env.NODE_ENV === "production"));
  const token = req.body?.recaptchaToken;

  if (!secret) {
    if (required) {
      return fail(
        res,
        503,
        "Security verification is not configured. Please try again later.",
      );
    }

    console.warn(
      "reCAPTCHA is not configured; allowing request in non-production.",
    );
    delete req.body.recaptchaToken;
    return next();
  }

  if (typeof token !== "string" || !token.trim()) {
    return fail(res, 400, "Complete the security check and try again.");
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    const verificationResponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(5000),
      },
    );
    const verification = await verificationResponse.json();
    if (!verification.success) {
      return fail(res, 403, "The security check could not be verified.");
    }

    delete req.body.recaptchaToken;
    return next();
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error.message);
    return fail(
      res,
      503,
      "The security check is temporarily unavailable. Please try again.",
    );
  }
};
