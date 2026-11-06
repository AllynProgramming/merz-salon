import dotenv from "dotenv";
import mongoose from "mongoose";

import Service from "../models/service.model.js";

dotenv.config();

const service = (name, category, price, description = "") => ({
  name,
  category,
  price,
  description,
  durationMinutes: 60,
  isActive: true,
});

const dripOptions = [
  ["Diamond Prestige Drip", 800, 7200, 10],
  ["Luchini Gold Boost Drip", 600, 5400, 10],
  ["Neocells", 600, 5400, 10],
  ["Collagen", 500, 4500, 10],
  ["Vitamin C Drip", 350, 1050, 3],
  ["Vitamin C Push", 200, 600, 3],
  ["Snow Glow Drip", 1500, 6000, 3],
  ["Snow White Drip", 1500, 4000, 4],
  ["Swiss Elixir Drip", 1000, 4000, 4],
  ["Cinderella Luminous Drip", 4000, 16000, 4],
];

const services = [
  service("Manicure / Pedicure", "Hand and Foot Care", 150),
  service("Footspa with Pedicure", "Hand and Foot Care", 400),
  service("Footspa", "Hand and Foot Care", 300),
  service("Gel Polish", "Hand and Foot Care", 400),
  service("Nail Extensions", "Hand and Foot Care", 600),
  service("Hand Massage", "Hand and Foot Care", 249),
  service("Foot Massage", "Hand and Foot Care", 349),

  service("4D Lash", "Eyelash Extension", 300),
  service("4D Volume Lash", "Eyelash Extension", 350),
  service("Wispy", "Eyelash Extension", 400),
  service("Volume Wispy", "Eyelash Extension", 500),
  service("Spire Lash Wispy", "Eyelash Extension", 450),
  service("Cat Eye", "Eyelash Extension", 400),
  service("Volume Cat Eye", "Eyelash Extension", 450),
  service("Doll Eye", "Eyelash Extension", 450),
  service("Mega Volume Lash", "Eyelash Extension", 450),

  service("Signature Facial", "Essential Facial Care", 500),
  service("Pristine Anti-Acne Facial", "Essential Facial Care", 600),
  service("Deluxe Facial", "Essential Facial Care", 700),
  service("Diamond Peel Facial", "Advanced Glow Treatment", 800),
  service("Aqua Hydra Facial", "Advanced Glow Treatment", 1100),
  service("Celebrity Carbon Laser", "Advanced Glow Treatment", 1250),
  service("Korean BB Glow", "Premium Skin Correction", 1100),

  service("RF Face", "Body Aesthetics", 500),
  service("RF Arms", "Body Aesthetics", 600),
  service("RF Tummy", "Body Aesthetics", 800),
  service("RF Back", "Body Aesthetics", 800),
  service("Vmax Face Lifting (Full Face)", "Body Aesthetics", 1000),
  service("Vmax Lower Face & Jawline", "Body Aesthetics", 799),
  service("Vmax Neck & Double Chin", "Body Aesthetics", 799),

  service("Underarm Cold Wax", "Waxing", 280),
  service("Underarm Hot Wax", "Waxing", 350),

  service("Threading", "Eyebrow Care", 150),
  service("Blading", "Eyebrow Care", 100),

  service(
    "Wart Removal",
    "Cauterization",
    null,
    "Price varies. Final price will be confirmed by salon staff.",
  ),

  ...dripOptions.flatMap(([name, sessionPrice, packagePrice, sessions]) => [
    service(
      name,
      "Glutathione IV Therapy",
      sessionPrice,
      "Price is per session.",
    ),
    service(
      `${name} (${sessions}-session package)`,
      "Glutathione IV Therapy",
      packagePrice,
      `Package price for ${sessions} sessions.`,
    ),
  ]),

  service("Haircut", "Hair Care", 150),
  service("Hair Iron", "Hair Care", 200),
  service("Blowdry", "Hair Care", 150),
  service("Blowdry and Iron", "Hair Care", 300),
  service("Hair Shampoo with Blowdry", "Hair Care", 250),
  service("Hair Cellophane", "Hair Care", 700),
  service("Hair Color", "Hair Care", 1000),
  service("Brazilian Treatment", "Hair Care", 1000),
  service("Rebond", "Hair Care", 1500),
  service("Protein Straight Bond", "Hair Care", 2500),
  service("Highlights", "Hair Care", 1000),
  service("Balayage", "Hair Care", 2000),
];

async function seedServices() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  try {
    await mongoose.connect(mongoUri);

    const catalogNames = services.map(({ name }) => name);
    const result = await Service.bulkWrite(
      services.map(({ name, ...serviceData }) => ({
        updateOne: {
          filter: { name },
          update: { $set: serviceData, $setOnInsert: { name } },
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const archived = await Service.updateMany(
      { name: { $nin: catalogNames }, isActive: true },
      { $set: { isActive: false } },
    );

    console.log(
      `Service catalog sync complete. Added ${result.upsertedCount} services, updated ${result.modifiedCount} existing services, and archived ${archived.modifiedCount} unmatched services.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedServices().catch((error) => {
  console.error("Service catalog sync failed:", error.message);
  process.exitCode = 1;
});
