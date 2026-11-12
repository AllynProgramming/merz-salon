import { z } from "zod";



const ratingSchema = z.coerce
  .number()
  .int()
  .min(1, "Please choose a rating from 1 to 5")
  .max(5, "Please choose a rating from 1 to 5");
const commentSchema = z.string().trim().max(1000, "Comment is too long");

const feedbackSchema = z
  .object({
    appointmentId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Appointment is required"),
    rating: ratingSchema,
    comment: commentSchema.optional().default(""),
  })
  .strict();

const feedbackUpdateSchema = z
  .object({
    rating: ratingSchema.optional(),
    comment: commentSchema.optional(),
  })
  .strict()
  .refine((data) => data.rating !== undefined || data.comment !== undefined, {
    message: "Provide a rating or comment to update.",
  });

export { ratingSchema };
export { commentSchema };
export { feedbackSchema };
export { feedbackUpdateSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
