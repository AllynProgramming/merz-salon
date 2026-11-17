import IntegrationSettings from "../models/integrationSettings.model.js";
import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

const calendarApi = "https://www.googleapis.com/calendar/v3";

const googleCalendarError = (message, cause) =>
  Object.assign(new Error(message), { statusCode: 502, cause });

const getCalendarId = (value) => {
  const calendarId = String(value || "").trim();
  return !calendarId || calendarId === "CALENDAR_ID" ? "primary" : calendarId;
};

const getConfig = async () => {
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  const clientId = process.env.GOOGLE_CLIENT_ID || secrets.googleClientId;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET || secrets.googleClientSecret;

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
    calendarId: getCalendarId(settings.calendarId),
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
    throw googleCalendarError(
      "Google Calendar authentication failed. Reconnect Google Calendar in Settings.",
      payload.error_description || payload.error,
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
    throw googleCalendarError(
      "Google Calendar request failed. Check the calendar connection and calendar ID.",
      payload.error?.message,
    );
  }
  return payload;
};

const formatDate = (date) => new Date(date).toISOString().slice(0, 10);

const buildEvent = async (appointment) => {
  const customerId = appointment.customer?._id || appointment.customer;
  const staffId = appointment.staff?._id || appointment.staff;
  const [customer, staff] = await Promise.all([
    appointment.customer?.email
      ? Promise.resolve(appointment.customer)
      : User.findById(customerId).select("name email").lean(),
    appointment.staff?.email
      ? Promise.resolve(appointment.staff)
      : User.findById(staffId).select("name email").lean(),
  ]);
  const walkInCustomer = appointment.walkInCustomer;
  const serviceName = appointment.service?.name || "Salon appointment";
  const date = formatDate(appointment.date);
  const timeZone = process.env.SALON_TIMEZONE || "Asia/Manila";
  const attendeeEmails = [
    customer?.email || walkInCustomer?.email,
    staff?.email,
  ]
    .map((email) => String(email || "").trim().toLowerCase())
    .filter((email, index, emails) => email && emails.indexOf(email) === index);

  return {
    summary: `${appointment.status === "cancelled" ? "[Cancelled] " : ""}${serviceName}`,
    description: [
      `MERZ Beauty Salon appointment`,
      `Status: ${appointment.status}`,
      appointment.bookingReference
        ? `Booking reference: ${appointment.bookingReference}`
        : "",
      customer?.name || walkInCustomer?.name
        ? `Customer: ${customer?.name || walkInCustomer.name}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: `${date}T${appointment.startTime}:00`, timeZone },
    end: { dateTime: `${date}T${appointment.endTime}:00`, timeZone },
    attendees: attendeeEmails.length
      ? attendeeEmails.map((email) => ({ email }))
      : undefined,
  };
};

export const syncAppointmentToGoogleCalendar = async (appointment) => {
  const config = await getConfig();
  if (!config) return null;

  const event = await buildEvent(appointment);
  const basePath = `/calendars/${encodeURIComponent(config.calendarId)}/events`;
  let synced;
  if (appointment.calendarEventId) {
    try {
      synced = await calendarRequest(
        config,
        `${basePath}/${encodeURIComponent(appointment.calendarEventId)}?sendUpdates=all`,
        { method: "PATCH", body: JSON.stringify(event) },
      );
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  if (!synced) {
    synced = await calendarRequest(config, `${basePath}?sendUpdates=all`, {
      method: "POST",
      body: JSON.stringify(event),
    });
  }

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
