import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

const serviceQuerySchema = z
  .object({
    category: z.string().trim().max(60, "Category is too long").optional(),
    search: z.string().trim().max(80, "Search is too long").optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const serviceInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    price: z.preprocess(
      (value) => (value === null ? null : value),
      z.coerce.number().finite().min(0).nullable(),
    ),
    durationMinutes: z.coerce.number().int().min(1).max(600),
    category: z.string().trim().max(60).default(""),
  })
  .strict();

export { serviceQuerySchema };
export { serviceInputSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
