import jwt from "jsonwebtoken";

export const requireAdminSettingsAccess = (req, res, next) => {
  const authHeader = req.headers["x-settings-access-token"];

  if (!authHeader) {
    return res.status(403).json({
      message: "Complete the settings security check first.",
      code: "SETTINGS_ACCESS_REQUIRED",
    });
  }

  try {
    const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
    if (
      decoded.type !== "admin-settings-access" ||
      String(decoded.userId) !== String(req.user?._id)
    ) {
      throw new Error("Invalid settings access token");
    }
  } catch {
    return res.status(403).json({
      message: "Your settings access has expired. Verify again.",
      code: "SETTINGS_ACCESS_EXPIRED",
    });
  }

  return next();
};
