import express from "express";
import connectDB from "./db/database.js";

import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(express.json());

// Variables
const PORT = process.env.PORT || 3000;

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send(`Server running on port ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
