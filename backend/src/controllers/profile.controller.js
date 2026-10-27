import bcrypt from "bcryptjs";
import { z } from "zod";

import User from "../models/user.model.js";

const profileUpdateSchema = z.object({
  firstname: z.string().trim().min(2, "First name is required"),
  lastname: z.string().trim().min(2, "Last name is required"),
  phoneNumber: z.string().trim().min(7, "Phone number is required"),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your new password"),
});

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name || [user.firstname, user.lastname].filter(Boolean).join(" "),
  firstname: user.firstname,
  lastname: user.lastname,
  email: user.email,
  phone: user.phone || user.phoneNumber,
  phoneNumber: user.phoneNumber,
  role: user.role,
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validation = profileUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: validation.error.issues[0]?.message || "Invalid profile data",
      });
    }

    const { firstname, lastname, phoneNumber } = validation.data;
    const normalizedPhoneNumber = phoneNumber.trim();

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    user.firstname = firstname.trim();
    user.lastname = lastname.trim();
    user.name = `${firstname.trim()} ${lastname.trim()}`;
    user.phone = normalizedPhoneNumber;
    user.phoneNumber = normalizedPhoneNumber;

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Phone number is already in use" });
    }
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validation = passwordChangeSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: validation.error.issues[0]?.message || "Invalid password data",
      });
    }

    const { currentPassword, newPassword, confirmPassword } = validation.data;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
