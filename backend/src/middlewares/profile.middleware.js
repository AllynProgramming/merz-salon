import { z } from "zod";



const profileUpdateSchema = z.object({
  firstname: z.string().trim().min(2, "First name is required"),
  lastname: z.string().trim().min(2, "Last name is required"),
  phoneNumber: z.string().trim().min(7, "Phone number is required"),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your new password"),
});

export { profileUpdateSchema };
export { passwordChangeSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
