import { z } from "zod";



const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    firstname: z.string().trim().min(2).max(60).optional(),
    lastname: z.string().trim().min(2).max(60).optional(),
    email: z.string().trim().email("Enter a valid email address").max(254),
    phone: z.string().trim().min(7).max(30).optional(),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(128),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (!data.name && (!data.firstname || !data.lastname)) {
      context.addIssue({
        code: "custom",
        message: "Enter your name",
        path: ["name"],
      });
    }
    if (!data.phone && !data.phoneNumber) {
      context.addIssue({
        code: "custom",
        message: "Enter your phone number",
        path: ["phone"],
      });
    }
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .optional(),
    phone: z.string().trim().min(7).max(30).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one profile field to update",
  });

export { signupSchema };
export { loginSchema };
export { updateMeSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
