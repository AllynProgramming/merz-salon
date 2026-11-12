import { z } from "zod";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const isValidDateOnly = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const objectIdPattern = /^[a-f\d]{24}$/i;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const appointmentStatuses = Object.values(APPOINTMENT_STATUS);

const appointmentQuerySchema = z
  .object({
    type: z.enum(["upcoming", "past", "all"]).optional(),
    status: z.enum(appointmentStatuses).optional(),
    from: z
      .string()
      .refine(isValidDateOnly, "Use a valid date in YYYY-MM-DD format")
      .optional(),
    to: z
      .string()
      .refine(isValidDateOnly, "Use a valid date in YYYY-MM-DD format")
      .optional(),
    search: z.string().trim().max(120).optional(),
    sort: z.enum(["date_asc", "date_desc"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()
  .refine(
    (filters) => !filters.from || !filters.to || filters.from <= filters.to,
    {
      message: "The end date must be on or after the start date.",
      path: ["to"],
    },
  );

const appointmentDetailSchema = z
  .object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid appointment id."),
  })
  .strict();
const staffAssignmentSchema = z
  .object({
    staffId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Choose a valid staff member.")
      .nullable(),
  })
  .strict();

const availabilitySchema = z
  .object({
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    excludeAppointmentId: z.string().regex(objectIdPattern).optional(),
  })
  .strict();

const availabilityCalendarSchema = z
  .object({
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    from: z.string().refine(isValidDateOnly, "Select a valid start date."),
    to: z.string().refine(isValidDateOnly, "Select a valid end date."),
  })
  .strict()
  .refine((range) => range.from <= range.to, {
    message: "The end date must be on or after the start date.",
    path: ["to"],
  });

const createAppointmentSchema = z
  .object({
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict();

const walkInCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
  })
  .strict();

const createStaffAppointmentSchema = z
  .object({
    customerId: z
      .string()
      .regex(objectIdPattern, "Choose a valid customer.")
      .optional(),
    walkInCustomer: walkInCustomerSchema.optional(),
    serviceId: z.string().regex(objectIdPattern, "Choose a valid service."),
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict()
  .refine(
    ({ customerId, walkInCustomer }) =>
      Boolean(customerId) !== Boolean(walkInCustomer),
    {
      message: "Choose a customer or enter walk-in customer details.",
      path: ["customerId"],
    },
  );

const staffCustomerSearchSchema = z
  .object({
    search: z.string().trim().min(2).max(80),
  })
  .strict();

const rescheduleSchema = z
  .object({
    date: z.string().refine(isValidDateOnly, "Select a valid date."),
    startTime: z.string().regex(timePattern, "Choose a valid time."),
  })
  .strict();

export { appointmentQuerySchema };
export { appointmentDetailSchema };
export { staffAssignmentSchema };
export { availabilitySchema };
export { availabilityCalendarSchema };
export { createAppointmentSchema };
export { walkInCustomerSchema };
export { createStaffAppointmentSchema };
export { staffCustomerSearchSchema };
export { rescheduleSchema };

export { validateBody, validateQuery, validateParams } from "./request-validation.middleware.js";
