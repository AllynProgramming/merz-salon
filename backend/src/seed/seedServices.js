import dotenv from "dotenv";
import mongoose from "mongoose";

import Service from "../models/service.model.js";

dotenv.config();

const sampleServices = [
  {
    name: "Haircut",
    category: "Hair",
    description:
      "A personalized cut finished to suit your style and hair texture.",
    price: 650,
    durationMinutes: 45,
  },
  {
    name: "Hair Color",
    category: "Hair",
    description:
      "A custom color service with a consultation and finished style.",
    price: 1800,
    durationMinutes: 120,
  },
  {
    name: "Hair Treatment",
    category: "Hair",
    description: "A restorative treatment for dry, stressed, or damaged hair.",
    price: 950,
    durationMinutes: 60,
  },
  {
    name: "Event Styling",
    category: "Hair",
    description: "A polished style for celebrations and special occasions.",
    price: 1200,
    durationMinutes: 60,
  },
  {
    name: "Manicure",
    category: "Nails",
    description: "Nail shaping, cuticle care, and a clean polish finish.",
    price: 450,
    durationMinutes: 45,
  },
  {
    name: "Pedicure",
    category: "Nails",
    description: "A relaxing foot-care service with shaping and polish.",
    price: 600,
    durationMinutes: 60,
  },
  {
    name: "Signature Facial",
    category: "Skin",
    description:
      "A cleansing and hydrating facial tailored to your skin needs.",
    price: 1100,
    durationMinutes: 60,
  },
  {
    name: "Scalp Ritual",
    category: "Wellness",
    description: "A gentle scalp cleanse and massage for a refreshed finish.",
    price: 800,
    durationMinutes: 45,
  },
];

async function seedServices() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  try {
    await mongoose.connect(mongoUri);

    let inserted = 0;
    for (const service of sampleServices) {
      const result = await Service.updateOne(
        { name: service.name },
        { $setOnInsert: service },
        { upsert: true, runValidators: true },
      );
      if (result.upsertedCount) inserted += 1;
    }

    console.log(
      `Service seed complete. Added ${inserted} new sample services.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedServices().catch((error) => {
  console.error("Service seed failed:", error.message);
  process.exitCode = 1;
});
