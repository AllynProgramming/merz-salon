import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  register,
  signup,
  login,
  logout,
  getMe,
  updateMe,
  googleLogin,
  googleCallback,
  requestPasswordReset,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import { verifyRecaptcha } from "../middlewares/recaptcha.middleware.js";
import {
  validateBody,
  signupSchema,
  loginSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../middlewares/auth-validation.middleware.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." },
});

router.post("/register", validateBody(signupSchema, { message: "Invalid registration data" }), register);
router.post("/signup", validateBody(signupSchema, { message: "Invalid registration data" }), signup);
router.post(
  "/login",
  loginLimiter,
  verifyRecaptcha(),
  validateBody(loginSchema, { message: "Invalid login data" }),
  login,
);
router.post("/logout", logout);
router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema, { message: "Enter a valid email address" }),
  requestPasswordReset,
);
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema, { message: "Invalid password reset data" }),
  resetPassword,
);
router.get("/me", protect, getMe);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.put("/me", protect, validateBody(updateMeSchema, { message: "Invalid profile data" }), updateMe);

export default router;
