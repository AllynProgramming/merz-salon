import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import User from "../models/user.model.js";

const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    firstname: z.string().trim().min(2).max(60).optional(),
    lastname: z.string().trim().min(2).max(60).optional(),
    email: z.string().trim().email("Enter a valid email address").max(254),
    phone: z.string().trim().min(7).max(30).optional(),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(128),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (!data.name && (!data.firstname || !data.lastname)) {
      context.addIssue({
        code: "custom",
        message: "Enter your name",
        path: ["name"],
      });
    }
    if (!data.phone && !data.phoneNumber) {
      context.addIssue({
        code: "custom",
        message: "Enter your phone number",
        path: ["phone"],
      });
    }
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .optional(),
    phone: z.string().trim().min(7).max(30).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one profile field to update",
  });

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name || [user.firstname, user.lastname].filter(Boolean).join(" "),
  email: user.email,
  phone: user.phone || user.phoneNumber,
  firstname: user.firstname,
  lastname: user.lastname,
  phoneNumber: user.phoneNumber,
  address: user.address || "",
  dateOfBirth: user.dateOfBirth || null,
  avatarUrl: user.avatarUrl || "",
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async (req, res, next) => {
  const validation = signupSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid registration data",
    });
  }

  const data = validation.data;
  const name = (data.name || `${data.firstname} ${data.lastname}`).trim();
  const nameParts = name.split(/\s+/);
  const phone = (data.phone || data.phoneNumber).trim();
  const email = data.email.toLowerCase();

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }, { phoneNumber: phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists",
      });
    }

    const password = await bcrypt.hash(data.password, 12);

    const user = await User.create({
      name,
      firstname: data.firstname || nameParts[0],
      lastname: data.lastname || nameParts.slice(1).join(" "),
      email,
      phone,
      phoneNumber: phone,
      password,
      role: "customer",
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      message: "Account registered successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists",
      });
    }
    return next(error);
  }
};

export const signup = register;

export const login = async (req, res, next) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: validation.error.issues[0]?.message || "Invalid login data",
    });
  }

  try {
    const { email, password } = validation.data;
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.role !== "customer") {
      return res
        .status(403)
        .json({ message: "This login is for customer accounts" });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const logout = (req, res) => {
  return res.status(200).json({
    message: "Logged out. Remove the bearer token from this client.",
  });
};

export const getMe = (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.user) });
};

export const updateMe = async (req, res, next) => {
  const validation = updateMeSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: validation.error.issues[0]?.message || "Invalid profile data",
    });
  }

  try {
    const updates = validation.data;
    const duplicateConditions = [];

    if (updates.email)
      duplicateConditions.push({ email: updates.email.toLowerCase() });
    if (updates.phone) {
      duplicateConditions.push(
        { phone: updates.phone },
        { phoneNumber: updates.phone },
      );
    }

    if (duplicateConditions.length) {
      const existingUser = await User.findOne({
        _id: { $ne: req.user._id },
        $or: duplicateConditions,
      });
      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email or phone number already exists",
        });
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Account not found" });

    if (updates.name) {
      user.name = updates.name;
      const [firstname, ...lastname] = updates.name.split(/\s+/);
      user.firstname = firstname;
      user.lastname = lastname.join(" ");
    }
    if (updates.email) user.email = updates.email.toLowerCase();
    if (updates.phone) {
      user.phone = updates.phone;
      user.phoneNumber = updates.phone;
    }

    await user.save();
    return res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists",
      });
    }
    return next(error);
  }
};
