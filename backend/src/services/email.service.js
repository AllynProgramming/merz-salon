import nodemailer from "nodemailer";

import IntegrationSettings from "../models/integrationSettings.model.js";
import User from "../models/user.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getTransport = async () => {
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  const host = secrets.smtpHost || process.env.SMTP_HOST;
  const user = secrets.smtpUser || process.env.SMTP_USER;
  const pass = secrets.smtpPass || process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return {
    secrets,
    transport: nodemailer.createTransport({
      host,
      port: Number(secrets.smtpPort || process.env.SMTP_PORT || 587),
      secure: Boolean(process.env.SMTP_SECURE === "true"),
      auth: { user, pass },
    }),
  };
};

const getAppointmentDetails = (appointment) => {
  const date = new Date(appointment.date);
  const appointmentDate = Number.isNaN(date.getTime())
    ? String(appointment.date)
    : date.toISOString().slice(0, 10);
  const serviceName =
    appointment.service?.name || appointment.serviceName || "salon service";

  return { appointmentDate, serviceName };
};

export const sendAppointmentEmail = async ({
  appointment,
  title,
  message,
}) => {
  try {
    const customerId = appointment?.customer?._id || appointment?.customer;
    if (!customerId) return false;

    const customer = appointment.customer?.email
      ? appointment.customer
      : await User.findById(customerId).select("name email").lean();
    if (!customer?.email) return false;

    const emailConfig = await getTransport();
    if (!emailConfig) {
      console.warn(
        "Appointment email was not sent: SMTP integration is not configured.",
      );
      return false;
    }

    const { appointmentDate, serviceName } = getAppointmentDetails(appointment);
    const safeTitle = escapeHtml(title);
    const safeMessage = escapeHtml(message);
    const details = [
      `Service: ${serviceName}`,
      `Date: ${appointmentDate}`,
      `Time: ${appointment.startTime}`,
      appointment.bookingReference
        ? `Booking reference: ${appointment.bookingReference}`
        : "",
    ].filter(Boolean);

    await emailConfig.transport.sendMail({
      from:
        emailConfig.secrets.smtpFrom ||
        process.env.SMTP_FROM ||
        emailConfig.secrets.smtpUser ||
        process.env.SMTP_USER,
      to: customer.email,
      subject: `MERZ Beauty Salon: ${title}`,
      text: `${title}\n\n${message}\n\n${details.join("\n")}`,
      html: `
        <h2>${safeTitle}</h2>
        <p>${safeMessage}</p>
        <p>${details.map((detail) => escapeHtml(detail)).join("<br />")}</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send appointment email:", error.message);
    return false;
  }
};
