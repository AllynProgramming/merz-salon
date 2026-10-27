import mongoose from "mongoose";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const appointmentStatuses = Object.values(APPOINTMENT_STATUS);

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: appointmentStatuses,
      default: APPOINTMENT_STATUS.PENDING,
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    remindersSent: {
      type: [String],
      default: [],
    },
    calendarEventId: {
      type: String,
      default: "",
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: appointmentStatuses,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: String,
          default: "system",
        },
        note: {
          type: String,
          default: "",
        },
      },
    ],
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ customer: 1, date: -1 });

const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

export default Appointment;
