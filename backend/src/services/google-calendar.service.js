import IntegrationSettings from "../models/integrationSettings.model.js";
import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

const calendarApi = "https://www.googleapis.com/calendar/v3";

const getConfig = async () => {
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  const clientId = secrets.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    secrets.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (
    !settings?.googleCalendar ||
    !secrets.calendarRefreshToken ||
    !clientId ||
    !clientSecret
  ) {
    return null;
  }

  return {
    settings,
    refreshToken: secrets.calendarRefreshToken,
    clientId,
    clientSecret,
    calendarId: settings.calendarId || "primary",
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
    throw new Error(
      payload.error_description || "Could not refresh Google Calendar access.",
    );
  }
  return payload.access_token;
};

const calendarRequest = async (config, path, options = {}) => {
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${calendarApi}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.error?.message || "Google Calendar request failed.",
    );
  }
  return payload;
};

const formatDate = (date) => new Date(date).toISOString().slice(0, 10);

const buildEvent = async (appointment) => {
  const customerId = appointment.customer?._id || appointment.customer;
  const customer = appointment.customer?.email
    ? appointment.customer
    : await User.findById(customerId).select("name email").lean();
  const serviceName = appointment.service?.name || "Salon appointment";
  const date = formatDate(appointment.date);
  const timeZone = process.env.SALON_TIMEZONE || "Asia/Manila";

  return {
    summary: `${appointment.status === "cancelled" ? "[Cancelled] " : ""}${serviceName}`,
    description: [
      `MERZ Beauty Salon appointment`,
      `Status: ${appointment.status}`,
      appointment.bookingReference
        ? `Booking reference: ${appointment.bookingReference}`
        : "",
      customer?.name ? `Customer: ${customer.name}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: `${date}T${appointment.startTime}:00`, timeZone },
    end: { dateTime: `${date}T${appointment.endTime}:00`, timeZone },
    attendees: customer?.email ? [{ email: customer.email }] : undefined,
  };
};

export const syncAppointmentToGoogleCalendar = async (appointment) => {
  const config = await getConfig();
  if (!config) return null;

  const event = await buildEvent(appointment);
  const basePath = `/calendars/${encodeURIComponent(config.calendarId)}/events`;
  const synced = appointment.calendarEventId
    ? await calendarRequest(
        config,
        `${basePath}/${encodeURIComponent(appointment.calendarEventId)}`,
        { method: "PATCH", body: JSON.stringify(event) },
      )
    : await calendarRequest(config, basePath, {
        method: "POST",
        body: JSON.stringify(event),
      });

  if (synced?.id && synced.id !== appointment.calendarEventId) {
    await Appointment.updateOne(
      { _id: appointment._id },
      { $set: { calendarEventId: synced.id } },
    );
  }
  return synced;
};

export const listGoogleCalendarEvents = async ({ timeMin, timeMax }) => {
  const config = await getConfig();
  if (!config) return { connected: false, events: [] };

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
  });
  const payload = await calendarRequest(
    config,
    `/calendars/${encodeURIComponent(config.calendarId)}/events?${params}`,
  );

  return {
    connected: true,
    events: payload.items || [],
  };
};
