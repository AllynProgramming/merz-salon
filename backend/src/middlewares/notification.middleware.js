import { z } from "zod";



const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    unreadOnly: z
      .preprocess((value) => value === "true" || value === true, z.boolean())
      .optional(),
  })
  .strict();

const notificationIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid notification id."),
});

export { paginationSchema };
export { notificationIdSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
