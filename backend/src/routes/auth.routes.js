import { Router } from "express";
import {
  register,
  signup,
  login,
  logout,
  getMe,
  updateMe,
  googleLogin,
  googleCallback,
} from "../controllers/auth.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import { verifyRecaptcha } from "../middlewares/recaptcha.middleware.js";
import {
  validateBody,
  signupSchema,
  loginSchema,
  updateMeSchema,
} from "../middlewares/auth-validation.middleware.js";

const router = Router();

router.post("/register", validateBody(signupSchema, { message: "Invalid registration data" }), register);
router.post("/signup", validateBody(signupSchema, { message: "Invalid registration data" }), signup);
router.post("/login", verifyRecaptcha(), validateBody(loginSchema, { message: "Invalid login data" }), login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.put("/me", protect, validateBody(updateMeSchema, { message: "Invalid profile data" }), updateMe);

export default router;
