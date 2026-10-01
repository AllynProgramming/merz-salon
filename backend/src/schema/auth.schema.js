import z from "zod";

export const signupSchema = z
  .object({
    firstname: z.string().min(2).max(100),
    lastname: z.string().min(2).max(100),
    email: z.string(),
    phoneNumber: z.string().min(10).max(15),
    password: z.string().min(6).max(100),
    confirmPassword: z.string().min(6).max(100),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
