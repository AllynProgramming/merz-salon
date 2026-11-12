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

export { paginationSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
