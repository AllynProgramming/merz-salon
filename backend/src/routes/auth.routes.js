import { Router } from "express";
import {
  register,
  signup,
  login,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { protect, requireCustomer } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
