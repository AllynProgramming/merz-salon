import { Router } from "express";
import {
  register,
  signup,
  login,
  logout,
  getMe,
  googleLogin,
  googleCallback,
} from "../controllers/auth.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";
import { verifyRecaptcha } from "../middlewares/recaptcha.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/signup", signup);
router.post("/login", verifyRecaptcha(), login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

export default router;
