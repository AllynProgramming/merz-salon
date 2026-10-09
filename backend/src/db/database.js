import mongoose from "mongoose";

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected:", mongoose.connection.host);
};

export default connectDB;
