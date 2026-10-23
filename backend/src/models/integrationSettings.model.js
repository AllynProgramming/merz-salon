import mongoose from "mongoose";

const integrationSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    emailNotifications: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true },
    googleCalendar: { type: Boolean, default: false },
    googleLogin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const IntegrationSettings =
  mongoose.models.IntegrationSettings ||
  mongoose.model("IntegrationSettings", integrationSettingsSchema);

export default IntegrationSettings;
