import mongoose from "mongoose";
import { z } from "zod";

import Service from "../models/service.model.js";

const serviceQuerySchema = z
  .object({
    category: z.string().trim().max(60, "Category is too long").optional(),
    search: z.string().trim().max(80, "Search is too long").optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getServices = async (req, res, next) => {
  const validation = serviceQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid service filters.",
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    });
  }

  const { category, search, limit } = validation.data;
  const filter = { isActive: true };

  if (category) {
    filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  }

  if (search) {
    const searchPattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: searchPattern }, { description: searchPattern }];
  }

  try {
    let serviceQuery = Service.find(filter)
      .select(
        "name description price durationMinutes category averageRating ratingCount",
      )
      .sort({ category: 1, name: 1 });
    if (limit) serviceQuery = serviceQuery.limit(limit);
    const services = await serviceQuery.lean();

    return res.status(200).json({ services });
  } catch (error) {
    return next(error);
  }
};

export const getServiceById = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid service id." });
  }

  try {
    const service = await Service.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .select(
        "name description price durationMinutes category averageRating ratingCount",
      )
      .lean();

    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    return res.status(200).json({ service });
  } catch (error) {
    return next(error);
  }
};
