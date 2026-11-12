import { z } from "zod";



const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), {
    message: "Use valid calendar dates.",
  });
const querySchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The end date must be on or after the start date.",
  });

export { dateSchema };
export { querySchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
