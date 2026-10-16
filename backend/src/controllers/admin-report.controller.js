import { z } from "zod";

import Appointment from "../models/appointment.model.js";
import Service from "../models/service.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.")
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()),
    {
      message: "Use valid calendar dates.",
    },
  );

const querySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The end date must be on or after the start date.",
  });

const startOfDay = (value) => new Date(`${value}T00:00:00.000Z`);
const nextDay = (value) =>
  new Date(`${value}T00:00:00.000Z`).getTime() + 86400000;
const dateValue = (date) => date.toISOString().slice(0, 10);

export const getAdminReport = async (req, res, next) => {
  const validation = querySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      message: validation.error.issues[0]?.message || "Invalid report dates.",
    });
  }

  const today = new Date();
  const defaultTo = dateValue(today);
  const defaultFromDate = new Date(today);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const from = validation.data.from || dateValue(defaultFromDate);
  const to = validation.data.to || defaultTo;
  const dateFilter = { $gte: startOfDay(from), $lt: new Date(nextDay(to)) };

  try {
    const [statusRows, serviceRows, customerRows, customerTotal] =
      await Promise.all([
        Appointment.aggregate([
          { $match: { date: dateFilter } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Appointment.aggregate([
          { $match: { date: dateFilter } },
          {
            $group: {
              _id: "$service",
              appointments: { $sum: 1 },
              completed: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", APPOINTMENT_STATUS.COMPLETED] },
                    1,
                    0,
                  ],
                },
              },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", APPOINTMENT_STATUS.COMPLETED] },
                    "$priceSnapshot",
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { appointments: -1, revenue: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "_id",
              as: "service",
            },
          },
          { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              name: { $ifNull: ["$service.name", "Removed service"] },
              appointments: 1,
              completed: 1,
              revenue: 1,
              averageRating: { $ifNull: ["$service.averageRating", 0] },
              ratingCount: { $ifNull: ["$service.ratingCount", 0] },
            },
          },
        ]),
        Appointment.aggregate([
          { $match: { date: dateFilter } },
          { $group: { _id: "$customer", visits: { $sum: 1 } } },
          { $sort: { visits: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "customer",
            },
          },
          { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              name: {
                $ifNull: [
                  "$customer.name",
                  {
                    $concat: ["$customer.firstname", " ", "$customer.lastname"],
                  },
                ],
              },
              visits: 1,
            },
          },
        ]),
        User.countDocuments({ role: "customer" }),
      ]);

    const byStatus = Object.fromEntries(
      Object.values(APPOINTMENT_STATUS).map((status) => [
        status,
        statusRows.find((row) => row._id === status)?.count || 0,
      ]),
    );

    return res.status(200).json({
      period: { from, to },
      appointments: {
        total: statusRows.reduce((total, row) => total + row.count, 0),
        byStatus,
      },
      services: serviceRows,
      customers: {
        total: customerTotal,
        activeInPeriod: customerRows.length,
        frequent: customerRows,
      },
    });
  } catch (error) {
    return next(error);
  }
};
