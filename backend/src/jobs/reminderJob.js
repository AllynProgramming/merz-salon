import cron from "node-cron";
import nodemailer from "nodemailer";

import Appointment from "../models/appointment.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";
import { reminderWindowHours, salonSchedule } from "../config/schedule.js";
import {
  getSalonClock,
  hasPassedConfirmationDeadline,
} from "../utils/salonTime.js";
import {
  buildStatusHistoryEntry,
  changeAppointmentStatus,
} from "../utils/appointmentStatus.js";
import {
  createAppointmentNotifications,
  syncReminderState,
} from "../services/notification.service.js";

let reminderJob;
let expirationJob;

const transport =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Boolean(process.env.SMTP_SECURE === "true"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

const formatAppointmentDate = (date, startTime) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return `${date} ${startTime}`;
  return `${parsed.toISOString().slice(0, 10)} ${startTime}`;
};

const sendReminderEmail = async (appointment, notification) => {
  if (!transport || !appointment.customer?.email) return false;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: appointment.customer.email,
      subject: notification.title,
      text: notification.message,
      html: `<p>${notification.message}</p>`,
    });
    return true;
  } catch (error) {
    console.error("Failed to send appointment reminder email:", error.message);
    return false;
  }
};

export const expireUnconfirmedAppointments = async () => {
  const salonNow = getSalonClock();
  const today = new Date(`${salonNow.date}T00:00:00.000Z`);
  const overdueAppointments = await Appointment.find({
    status: APPOINTMENT_STATUS.PENDING,
    date: { $lte: today },
  })
    .populate("service", "name")
    .select("_id customer service date startTime status statusHistory");

  for (const appointment of overdueAppointments) {
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    if (
      !hasPassedConfirmationDeadline({
        appointmentDate,
        startTime: appointment.startTime,
        salonNow,
      })
    ) {
      continue;
    }

    const expiredAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: APPOINTMENT_STATUS.PENDING },
      {
        $set: { status: APPOINTMENT_STATUS.EXPIRED },
        $push: {
          statusHistory: buildStatusHistoryEntry({
            status: APPOINTMENT_STATUS.EXPIRED,
            changedBy: "system",
            note: `Booking expired because it was not confirmed within ${salonSchedule.appointmentConfirmationGraceMinutes} minutes after its scheduled start time.`,
          }),
        },
      },
      { new: true },
    );
    if (!expiredAppointment) continue;

    await createAppointmentNotifications({
      appointment: expiredAppointment,
      type: "booking_expired",
      title: "Appointment request expired",
      message: `Your ${appointment.service?.name || "appointment"} request for ${appointmentDate} at ${appointment.startTime} expired because it was not confirmed within ${salonSchedule.appointmentConfirmationGraceMinutes} minutes after the scheduled start. Please book another time.`,
    });
  }
};

export const completePastAppointments = async () => {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const appointments = await Appointment.find({
    status: APPOINTMENT_STATUS.CONFIRMED,
    date: { $lte: today },
  });

  for (const appointment of appointments) {
    const date = appointment.date.toISOString().slice(0, 10);
    const endTime = new Date(`${date}T${appointment.endTime}:00`);
    if (endTime >= now) continue;

    changeAppointmentStatus(appointment, APPOINTMENT_STATUS.COMPLETED, {
      changedBy: "system",
      note: "Appointment completed automatically after its scheduled end time.",
    });
    await appointment.save();
  }
};

export const sendAppointmentReminders = async () => {
  const now = new Date();
  const upcoming = await Appointment.find({
    status: { $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
    date: {
      $gte: new Date(now.getTime() - 1000 * 60 * 60 * 6),
      $lte: new Date(now.getTime() + 1000 * 60 * 60 * 48),
    },
  })
    .populate("customer", "name email")
    .populate("service", "name")
    .lean();

  for (const appointment of upcoming) {
    const appointmentDate = new Date(appointment.date);
    const [hours, minutes] = String(appointment.startTime || "00:00")
      .split(":")
      .map(Number);
    const startTime = new Date(
      appointmentDate.getFullYear(),
      appointmentDate.getMonth(),
      appointmentDate.getDate(),
      hours,
      minutes,
    );

    const hoursUntil = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const reminderTypes = [];

    if (
      hoursUntil <= Number(reminderWindowHours.default || 24) &&
      !appointment.remindersSent?.includes("default")
    ) {
      reminderTypes.push("default");
    }
    if (
      hoursUntil <= Number(reminderWindowHours.secondary || 2) &&
      !appointment.remindersSent?.includes("secondary")
    ) {
      reminderTypes.push("secondary");
    }

    for (const reminderType of reminderTypes) {
      const reminderMessage =
        reminderType === "secondary"
          ? `This is a reminder that your ${appointment.service?.name || "appointment"} starts in ${Math.max(0, Math.round(hoursUntil))} hours.`
          : `Your ${appointment.service?.name || "appointment"} is coming up on ${formatAppointmentDate(appointment.date, appointment.startTime)}.`;

      const notification = await createAppointmentNotifications({
        appointment: {
          _id: appointment._id,
          customer: appointment.customer?._id,
        },
        type: "reminder",
        title: "Appointment reminder",
        message: reminderMessage,
      });

      if (notification) {
        const emailSent = await sendReminderEmail(appointment, notification);
        notification.emailSent = emailSent;
        await notification.save();
      }

      await syncReminderState(String(appointment._id), reminderType);
    }
  }
};

export const startReminderJob = () => {
  if (reminderJob && expirationJob) return reminderJob;

  if (!expirationJob) {
    expirationJob = cron.schedule("* * * * *", async () => {
    try {
      await expireUnconfirmedAppointments();
    } catch (error) {
      console.error("Appointment expiration job failed:", error.message);
    }
    });
  }

  if (!reminderJob) {
    reminderJob = cron.schedule("*/15 * * * *", async () => {
    try {
      await completePastAppointments();
      await sendAppointmentReminders();
    } catch (error) {
      console.error("Reminder job failed:", error.message);
    }
    });
  }

  return reminderJob;
};
