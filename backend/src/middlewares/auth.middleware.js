import jwt from "jsonwebtoken";

import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({ message: "Account not found" });
  }

  req.user = user;
  return next();
};

export const requireCustomer = (req, res, next) => {
  if (!req.user || req.user.role !== "customer") {
    return res.status(403).json({ message: "Customer access is required" });
  }

  return next();
};
