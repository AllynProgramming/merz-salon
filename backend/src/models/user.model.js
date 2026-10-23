import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    firstname: {
      type: String,
      trim: true,
    },
    lastname: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },
    workingHours: {
      type: [
        new mongoose.Schema(
          {
            weekday: { type: Number, min: 0, max: 6, required: true },
            enabled: { type: Boolean, default: false },
            startTime: { type: String, default: "09:00" },
            endTime: { type: String, default: "18:00" },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
  },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
