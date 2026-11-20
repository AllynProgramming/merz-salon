import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { validateIntegrationCredentials } from "./validateIntegrationCredentials.js";

const originalFetch = globalThis.fetch;
const googleCredentials = {
  googleClientId: "test.apps.googleusercontent.com",
  googleClientSecret: "test-client-secret",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const response = (payload) => ({
  json: async () => payload,
});

test("accepts Google credentials when the invalid test code is rejected", async () => {
  globalThis.fetch = async () => response({ error: "invalid_grant" });

  await assert.doesNotReject(
    validateIntegrationCredentials({
      credentials: googleCredentials,
      changedFields: new Set(["googleClientId", "googleClientSecret"]),
    }),
  );
});

test("rejects Google credentials only when Google rejects the client", async () => {
  globalThis.fetch = async () => response({ error: "invalid_client" });

  await assert.rejects(
    validateIntegrationCredentials({
      credentials: googleCredentials,
      changedFields: new Set(["googleClientId", "googleClientSecret"]),
    }),
    {
      statusCode: 400,
      message: "Google credentials: The client ID or client secret is invalid.",
    },
  );
});

test("rejects a Google client ID with an invalid format", async () => {
  await assert.rejects(
    validateIntegrationCredentials({
      credentials: {
        googleClientId: "not-a-google-client-id",
        googleClientSecret: "test-client-secret",
      },
      changedFields: new Set(["googleClientId"]),
    }),
    {
      statusCode: 400,
      message: "Google client ID: Enter a valid Google OAuth client ID.",
    },
  );
});

test("requires both Google credentials during initial setup", async () => {
  await assert.rejects(
    validateIntegrationCredentials({
      credentials: { googleClientId: googleCredentials.googleClientId },
      changedFields: new Set(["googleClientId"]),
    }),
    {
      statusCode: 400,
      message: "Google credentials: Both the client ID and client secret are required.",
    },
  );
});

test("accepts authenticated Google credentials when the client disallows the test grant", async () => {
  globalThis.fetch = async () => response({ error: "unauthorized_client" });

  await assert.doesNotReject(
    validateIntegrationCredentials({
      credentials: googleCredentials,
      changedFields: new Set(["googleClientId", "googleClientSecret"]),
    }),
  );
});

test("accepts a reCAPTCHA secret when only the dummy response is rejected", async () => {
  globalThis.fetch = async () =>
    response({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

  await assert.doesNotReject(
    validateIntegrationCredentials({
      credentials: { recaptchaSecretKey: "test-recaptcha-secret" },
      changedFields: new Set(["recaptchaSecretKey"]),
    }),
  );
});

test("rejects a reCAPTCHA secret explicitly reported as invalid", async () => {
  globalThis.fetch = async () =>
    response({
      success: false,
      "error-codes": ["invalid-input-secret"],
    });

  await assert.rejects(
    validateIntegrationCredentials({
      credentials: { recaptchaSecretKey: "invalid-recaptcha-secret" },
      changedFields: new Set(["recaptchaSecretKey"]),
    }),
    {
      statusCode: 400,
      message: "reCAPTCHA secret key: Secret key is invalid",
    },
  );
});

test("does not accept an unrecognized reCAPTCHA verification response", async () => {
  globalThis.fetch = async () => response({ success: false });

  await assert.rejects(
    validateIntegrationCredentials({
      credentials: { recaptchaSecretKey: "test-recaptcha-secret" },
      changedFields: new Set(["recaptchaSecretKey"]),
    }),
    {
      statusCode: 400,
      message: "reCAPTCHA secret key: Could not validate the key. Try again.",
    },
  );
});
