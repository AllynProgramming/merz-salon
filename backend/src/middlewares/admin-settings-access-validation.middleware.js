import { z } from "zod";



const requestSchema = z.object({
  superPin: z.string().trim().min(1).max(128),
});

const verifySchema = z.object({
  challengeToken: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export { requestSchema };
export { verifySchema };
