import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const createStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(30),
    role: z.enum(["staff", "manager", "admin"]).default("staff"),
  })
  .strict();

const updateStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    role: z.enum(["staff", "manager", "admin"]).optional(),
    resetPassword: z.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.role !== undefined ||
      data.resetPassword,
    "Provide a name, phone number, or password reset.",
  );

const workingHoursSchema = z
  .object({
    workingHours: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            enabled: z.boolean(),
            startTime: z.string().regex(timePattern),
            endTime: z.string().regex(timePattern),
          })
          .strict()
          .refine(
            (hours) => !hours.enabled || hours.startTime < hours.endTime,
            "Closing time must be after opening time.",
          ),
      )
      .length(7),
  })
  .strict()
  .refine(
    ({ workingHours }) =>
      new Set(workingHours.map(({ weekday }) => weekday)).size === 7,
    "Working hours must include each day of the week once.",
  );

const staffParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid staff member."),
});

export { createStaffSchema };
export { updateStaffSchema };
export { workingHoursSchema };
export { staffParamsSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
