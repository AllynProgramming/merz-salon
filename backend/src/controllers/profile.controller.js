import bcrypt from "bcryptjs";

import User from "../models/user.model.js";

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

    const { firstname, lastname, phoneNumber } = req.body;
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

    const { currentPassword, newPassword, confirmPassword } = req.body;

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
