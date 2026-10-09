import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "booking_pending",
        "booking_confirmed",
        "rescheduled",
        "cancelled",
        "reminder",
        "feedback_received",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
