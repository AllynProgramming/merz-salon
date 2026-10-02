import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const phonePattern = /^\+?[0-9().\s-]{7,30}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be 60 characters or fewer"),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number is required")
      .max(30, "Phone must be 30 characters or fewer")
      .regex(phonePattern, "Enter a valid phone number")
      .refine(
        (value) => (value.match(/\d/g) || []).length >= 7,
        "Enter at least 7 digits for your phone number",
      ),
    address: z
      .string()
      .trim()
      .max(200, "Address must be 200 characters or fewer")
      .optional(),
    dateOfBirth: z
      .string()
      .refine((value) => {
        if (!value) return true;
        if (!datePattern.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, "Enter a valid date")
      .refine(
        (value) =>
          value === "" || value <= new Date().toISOString().slice(0, 10),
        "Date of birth cannot be in the future",
      )
      .optional(),
    avatarUrl: z
      .string()
      .trim()
      .max(500, "Avatar URL must be 500 characters or fewer")
      .refine((value) => {
        if (!value) return true;
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "Enter a valid image URL")
      .optional(),
  })
  .strict();

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128),
    confirmPassword: z.string().min(1, "Confirm your new password").max(128),
  })
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (data.newPassword === data.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current one",
        path: ["newPassword"],
      });
    }
  });

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name || [user.firstname, user.lastname].filter(Boolean).join(" "),
  email: user.email,
  phone: user.phone || user.phoneNumber || "",
  address: user.address || "",
  dateOfBirth: user.dateOfBirth || null,
  avatarUrl: user.avatarUrl || "",
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const validationErrors = (issues) => {
  const errors = {};
  for (const issue of issues) {
    const field = issue.path[0] || "_form";
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
};

export const getCustomerProfile = (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.user) });
};

export const updateCustomerProfile = async (req, res, next) => {
  const validation = profileSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: "Check the highlighted profile fields.",
      errors: validationErrors(validation.error.issues),
    });
  }

  const updates = {
    name: validation.data.name,
    phone: validation.data.phone,
    address: validation.data.address ?? "",
    dateOfBirth: validation.data.dateOfBirth || null,
    avatarUrl: validation.data.avatarUrl || "",
  };

  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $set: { ...updates, phoneNumber: updates.phone } },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user)
      return res.status(404).json({ message: "Customer profile not found" });

    return res.status(200).json({
      message: "Profile saved successfully.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "That phone number is already in use.",
        errors: { phone: "That phone number is already in use." },
      });
    }
    return next(error);
  }
};

export const changeCustomerPassword = async (req, res, next) => {
  const validation = passwordSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: "Check the highlighted password fields.",
      errors: validationErrors(validation.error.issues),
    });
  }

  try {
    const user = await User.findOne({ _id: req.user.id }).select("+password");
    if (!user)
      return res.status(404).json({ message: "Customer account not found" });

    const currentMatches = await bcrypt.compare(
      validation.data.currentPassword,
      user.password,
    );
    if (!currentMatches) {
      return res.status(400).json({
        message: "Your current password is incorrect.",
        errors: { currentPassword: "Your current password is incorrect." },
      });
    }

    user.password = await bcrypt.hash(validation.data.newPassword, 12);
    await user.save();

    if (!process.env.JWT_SECRET)
      throw new Error("JWT_SECRET is not configured");
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return res.status(200).json({
      message: "Password changed successfully.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const appointmentStart = (appointment) => {
  const day = new Date(appointment.date).toISOString().slice(0, 10);
  const [hours, minutes] = String(appointment.startTime || "00:00")
    .split(":")
    .map(Number);
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, hours, minutes);
};

export const getCustomerDashboard = async (req, res, next) => {
  try {
    const statuses = Object.values(APPOINTMENT_STATUS);
    const [total, ...statusCounts] = await Promise.all([
      Appointment.countDocuments({ customer: req.user.id }),
      ...statuses.map((status) =>
        Appointment.countDocuments({ customer: req.user.id, status }),
      ),
    ]);

    const counts = Object.fromEntries(
      statuses.map((status, index) => [status, statusCounts[index]]),
    );
    counts.total = total;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const candidates = await Appointment.find({
      customer: req.user.id,
      status: {
        $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
      },
      date: { $gte: today },
    })
      .populate("service", "name")
      .sort({ date: 1, startTime: 1 })
      .lean();

    const now = new Date();
    const allUpcomingAppointments = candidates.filter(
      (appointment) => appointmentStart(appointment) > now,
    );
    counts.upcoming = allUpcomingAppointments.length;

    const upcomingAppointments = allUpcomingAppointments
      .slice(0, 5)
      .map((appointment) => ({
        _id: appointment._id,
        service: appointment.service
          ? { _id: appointment.service._id, name: appointment.service.name }
          : null,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      }));

    return res.status(200).json({
      upcomingAppointments,
      nextAppointment: upcomingAppointments[0] || null,
      counts,
    });
  } catch (error) {
    return next(error);
  }
};
