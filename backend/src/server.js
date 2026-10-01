import express from "express";
import cors from "cors";
import { config } from "dotenv";

import connectDB from "./db/database.js";
import authRoutes from "./routes/auth.routes.js";

config();

const app = express();

app.use(express.json());
app.use(cors());

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
