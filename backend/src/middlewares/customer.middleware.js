import { z } from "zod";


const phonePattern = /^\+?[0-9().\s-]{7,30}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be 60 characters or fewer"),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number is required")
      .max(30, "Phone must be 30 characters or fewer")
      .regex(phonePattern, "Enter a valid phone number")
      .refine(
        (value) => (value.match(/\d/g) || []).length >= 7,
        "Enter at least 7 digits for your phone number",
      ),
    address: z
      .string()
      .trim()
      .max(200, "Address must be 200 characters or fewer")
      .optional(),
    dateOfBirth: z
      .string()
      .refine((value) => {
        if (!value) return true;
        if (!datePattern.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, "Enter a valid date")
      .refine(
        (value) =>
          value === "" || value <= new Date().toISOString().slice(0, 10),
        "Date of birth cannot be in the future",
      )
      .optional(),
    avatarUrl: z
      .string()
      .trim()
      .max(500, "Avatar URL must be 500 characters or fewer")
      .refine((value) => {
        if (!value) return true;
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "Enter a valid image URL")
      .optional(),
  })
  .strict();

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128),
    confirmPassword: z.string().min(1, "Confirm your new password").max(128),
  })
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (data.newPassword === data.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current one",
        path: ["newPassword"],
      });
    }
  });

export { profileSchema };
export { passwordSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
