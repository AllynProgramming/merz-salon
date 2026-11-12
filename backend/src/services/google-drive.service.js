import IntegrationSettings from "../models/integrationSettings.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

const driveApi = "https://www.googleapis.com/drive/v3";
const uploadApi = "https://www.googleapis.com/upload/drive/v3/files";

const getConfig = async () => {
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  const clientId = secrets.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    secrets.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!settings?.googleDrive || !secrets.driveRefreshToken || !clientId || !clientSecret) {
    return null;
  }

  return {
    refreshToken: secrets.driveRefreshToken,
    clientId,
    clientSecret,
    folderId: settings.driveFolderId || "",
  };
};

const getAccessToken = async (config) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Could not refresh Google Drive access.");
  }
  return payload.access_token;
};

export const uploadReportToGoogleDrive = async ({ filename, pdf }) => {
  const config = await getConfig();
  if (!config) throw new Error("Google Drive is not connected.");

  const accessToken = await getAccessToken(config);
  const metadata = {
    name: filename,
    mimeType: "application/pdf",
    ...(config.folderId ? { parents: [config.folderId] } : {}),
  };
  const boundary = `merz-report-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    pdf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch(`${uploadApi}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "Google Drive upload failed.");
  }
  return payload;
};

export const isGoogleDriveConnected = async () => Boolean(await getConfig());
