import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { sendEmail } from "../services/email.service.js";

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

const secretsMatch = (provided, expected) =>
  crypto.timingSafeEqual(
    Buffer.from(hashOtp(provided), "hex"),
    Buffer.from(hashOtp(expected), "hex"),
  );

const getSettingsAccessToken = (userId) =>
  jwt.sign(
    { type: "admin-settings-access", userId: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

export const requestSettingsAccess = async (req, res) => {
  if (!process.env.ADMIN_SUPER_PIN) {
    return res.status(503).json({
      message: "Settings security is not configured on the server.",
    });
  }

  if (!secretsMatch(req.body.superPin, process.env.ADMIN_SUPER_PIN)) {
    return res.status(401).json({ message: "The settings super PIN is incorrect." });
  }

  const adminEmail = req.user.email;
  if (!adminEmail) {
    return res.status(503).json({
      message: "The admin account has no email address for OTP delivery.",
    });
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const challengeToken = jwt.sign(
    {
      type: "admin-settings-otp",
      userId: String(req.user._id),
      otpHash: hashOtp(otp),
    },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );

  try {
    await sendEmail({
      to: adminEmail,
      subject: "MERZ settings verification code",
      text: `Your MERZ admin settings verification code is ${otp}. It expires in 5 minutes.`,
      html: `<p>Your MERZ admin settings verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
    });
    return res.status(200).json({
      message: "A verification code was sent to the admin email address.",
      challengeToken,
    });
  } catch (error) {
    console.error("Could not send admin settings OTP:", error.message);
    return res.status(503).json({
      message:
        "The verification code could not be sent. Configure SMTP settings and try again.",
    });
  }
};

export const verifySettingsAccess = async (req, res) => {
  try {
    const challenge = jwt.verify(
      req.body.challengeToken,
      process.env.JWT_SECRET,
    );
    const submittedHash = hashOtp(req.body.otp);
    const expectedHash = Buffer.from(challenge.otpHash || "");
    const actualHash = Buffer.from(submittedHash);
    if (
      challenge.type !== "admin-settings-otp" ||
      String(challenge.userId) !== String(req.user._id) ||
      expectedHash.length !== actualHash.length ||
      !crypto.timingSafeEqual(expectedHash, actualHash)
    ) {
      throw new Error("Invalid settings verification code");
    }

    return res.status(200).json({
      message: "Settings access verified.",
      accessToken: getSettingsAccessToken(req.user._id),
    });
  } catch {
    return res.status(401).json({
      message: "That verification code is invalid or expired.",
    });
  }
};
