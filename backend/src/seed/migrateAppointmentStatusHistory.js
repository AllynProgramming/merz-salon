import mongoose from "mongoose";
import dotenv from "dotenv";

import Appointment from "../models/appointment.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

dotenv.config();

async function migrateStatusHistory() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/merz";
  await mongoose.connect(uri);

  const appointments = await Appointment.find({
    $or: [
      { statusHistory: { $exists: false } },
      { statusHistory: { $size: 0 } },
    ],
  });

  for (const appointment of appointments) {
    const initialStatus = appointment.status || APPOINTMENT_STATUS.PENDING;
    appointment.statusHistory = [
      {
        status: initialStatus,
        changedAt: appointment.createdAt || new Date(),
        changedBy: "system",
        note: "Initial booking status",
      },
    ];
    await appointment.save();
  }

  console.log(
    `Backfilled status history for ${appointments.length} appointments.`,
  );
  await mongoose.disconnect();
}

migrateStatusHistory().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
