import nodemailer from "nodemailer";

const googleTokenUrl = "https://oauth2.googleapis.com/token";
const recaptchaVerifyUrl = "https://www.google.com/recaptcha/api/siteverify";

const validationError = (field, message) =>
  Object.assign(new Error(`${field}: ${message}`), { statusCode: 400 });

const hasChanged = (changedFields, field) => changedFields.has(field);

const validateGoogleCredentials = async (clientId, clientSecret) => {
  if (!clientId || !clientSecret) return;

  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: "credential-validation",
      grant_type: "authorization_code",
      redirect_uri: "http://localhost",
    }),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.error === "invalid_client") {
    throw validationError(
      "Google credentials",
      "The client ID or client secret is invalid.",
    );
  }
  if (
    payload.error !== "invalid_grant" &&
    payload.error !== "unauthorized_client"
  ) {
    throw new Error("Google credentials could not be verified.");
  }
};

const validateRecaptchaSecret = async (secret) => {
  const response = await fetch(recaptchaVerifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret,
      response: "credential-validation",
    }),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  const errorCodes = payload["error-codes"] || [];
  if (errorCodes.includes("invalid-input-secret")) {
    throw validationError("reCAPTCHA secret key", "Secret key is invalid");
  }
  if (
    payload.success !== true &&
    !errorCodes.includes("invalid-input-response")
  ) {
    throw new Error("reCAPTCHA secret key could not be verified.");
  }
};

const validateSmtpCredentials = async (credentials) => {
  const port = Number(credentials.smtpPort || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw validationError("SMTP port", "Enter a valid port number.");
  }

  if (
    !credentials.smtpHost ||
    !credentials.smtpUser ||
    !credentials.smtpPass
  ) {
    return;
  }

  const transport = nodemailer.createTransport({
    host: credentials.smtpHost,
    port,
    secure: port === 465,
    auth: {
      user: credentials.smtpUser,
      pass: credentials.smtpPass,
    },
  });
  try {
    await transport.verify();
  } catch (error) {
    if (error.code === "EAUTH" || Number(error.responseCode) === 535) {
      throw validationError(
        "SMTP credentials",
        "The SMTP username or password is invalid.",
      );
    }
    throw new Error("SMTP server could not be verified.");
  } finally {
    transport.close();
  }
};

export const validateIntegrationCredentials = async ({
  credentials,
  changedFields,
}) => {
  if (
    hasChanged(changedFields, "googleClientId") &&
    !/^[\w-]+\.apps\.googleusercontent\.com$/i.test(
      credentials.googleClientId || "",
    )
  ) {
    throw validationError(
      "Google client ID",
      "Enter a valid Google OAuth client ID.",
    );
  }

  if (
    (hasChanged(changedFields, "googleClientId") ||
      hasChanged(changedFields, "googleClientSecret")) &&
    (!credentials.googleClientId || !credentials.googleClientSecret)
  ) {
    throw validationError(
      "Google credentials",
      "Both the client ID and client secret are required.",
    );
  }

  if (
    hasChanged(changedFields, "googleClientId") ||
    hasChanged(changedFields, "googleClientSecret")
  ) {
    try {
      await validateGoogleCredentials(
        credentials.googleClientId,
        credentials.googleClientSecret,
      );
    } catch (error) {
      if (error.statusCode) throw error;
      throw validationError(
        "Google credentials",
        "Could not validate the credentials. Try again.",
      );
    }
  }

  if (hasChanged(changedFields, "recaptchaSecretKey")) {
    try {
      await validateRecaptchaSecret(credentials.recaptchaSecretKey);
    } catch (error) {
      if (error.statusCode) throw error;
      throw validationError(
        "reCAPTCHA secret key",
        "Could not validate the key. Try again.",
      );
    }
  }

  const smtpFields = new Set([
    "smtpHost",
    "smtpPort",
    "smtpUser",
    "smtpPass",
    "smtpFrom",
  ]);
  if ([...changedFields].some((field) => smtpFields.has(field))) {
    try {
      await validateSmtpCredentials(credentials);
    } catch (error) {
      if (error.statusCode) throw error;
      throw validationError(
        "SMTP credentials",
        "Could not validate the mail server. Try again.",
      );
    }
  }
};
