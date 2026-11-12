import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import User from "../models/user.model.js";
import IntegrationSettings from "../models/integrationSettings.model.js";
import { getIntegrationSecrets } from "../utils/integrationSecrets.js";

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
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async (req, res, next) => {
  const data = req.body;
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
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const allowedRoles = ["customer", "staff", "manager", "admin"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "This account is not allowed to sign in here." });
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

const getGoogleConfig = async () => {
  const secrets = await getIntegrationSecrets(IntegrationSettings);
  return {
    clientId: secrets.googleClientId || process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      secrets.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      secrets.googleOauthRedirectUri ||
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      "http://localhost:3000/api/auth/google/callback",
  };
};

const isGoogleLoginEnabled = async (googleConfig) => {
  const settings = await IntegrationSettings.findOne({ key: "default" }).lean();
  return Boolean(
    settings?.googleLogin &&
      googleConfig.clientId &&
      googleConfig.clientSecret &&
      googleConfig.redirectUri,
  );
};

export const googleLogin = async (req, res, next) => {
  try {
    const googleConfig = await getGoogleConfig();
    if (!(await isGoogleLoginEnabled(googleConfig))) {
      return res.status(403).json({ message: "Google login is currently disabled." });
    }

    const params = new URLSearchParams({
      client_id: googleConfig.clientId,
      redirect_uri: googleConfig.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (error) {
    return next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";
  try {
    const googleConfig = await getGoogleConfig();
    if (!(await isGoogleLoginEnabled(googleConfig))) {
      return res.redirect(`${frontendUrl}/login?google_error=disabled`);
    }
    if (!req.query.code) {
      return res.redirect(`${frontendUrl}/login?google_error=missing_code`);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: googleConfig.clientId,
        client_secret: googleConfig.clientSecret,
        redirect_uri: googleConfig.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.redirect(`${frontendUrl}/login?google_error=exchange_failed`);
    }

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenPayload.access_token}` } },
    );
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub || !profile.email_verified) {
      return res.redirect(`${frontendUrl}/login?google_error=profile_failed`);
    }

    let user = await User.findOne({
      $or: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }],
    });
    if (user && user.role !== "customer") {
      return res.redirect(`${frontendUrl}/login?google_error=customer_only`);
    }
    if (!user) {
      const name = profile.name || profile.email.split("@")[0];
      const generatedPhone = `google-${profile.sub}`.slice(0, 30);
      user = await User.create({
          name,
          firstname: profile.given_name || name.split(/\s+/)[0],
          lastname: profile.family_name || name.split(/\s+/).slice(1).join(" "),
          email: profile.email.toLowerCase(),
          phone: generatedPhone,
          phoneNumber: generatedPhone,
          password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
          googleId: profile.sub,
          avatarUrl: profile.picture || "",
          role: "customer",
        });
    } else {
      user.googleId = profile.sub;
      if (profile.picture && !user.avatarUrl) user.avatarUrl = profile.picture;
      await user.save();
    }

    const token = generateToken(user._id);
    return res.redirect(
      `${frontendUrl}/auth/google/callback?token=${encodeURIComponent(token)}`,
    );
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    if (error.code === 11000) {
      return res.redirect(`${frontendUrl}/login?google_error=account_conflict`);
    }
    return res.redirect(`${frontendUrl}/login?google_error=server`);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const updates = req.body;
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
