import mongoose from "mongoose";

import Service from "../models/service.model.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateServiceId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid service id." });
    return false;
  }
  return true;
};

export const getServices = async (req, res, next) => {
  const { category, search, limit } = req.body;
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

export const getAdminServices = async (req, res, next) => {
  try {
    const services = await Service.find({})
      .sort({ isActive: -1, category: 1, name: 1 })
      .lean();

    return res.status(200).json({ services });
  } catch (error) {
    return next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    return res.status(201).json({ message: "Service created.", service });
  } catch (error) {
    return next(error);
  }
};

export const updateService = async (req, res, next) => {
  if (!validateServiceId(req.params.id, res)) return;

  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    Object.assign(service, req.body);
    await service.save();
    return res.status(200).json({ message: "Service updated.", service });
  } catch (error) {
    return next(error);
  }
};

export const archiveService = async (req, res, next) => {
  if (!validateServiceId(req.params.id, res)) return;

  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: { isActive: false } },
      { new: true, runValidators: true },
    );
    if (!service) {
      return res.status(404).json({ message: "Active service not found." });
    }

    return res.status(200).json({ message: "Service archived.", service });
  } catch (error) {
    return next(error);
  }
};

export const restoreService = async (req, res, next) => {
  if (!validateServiceId(req.params.id, res)) return;

  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, isActive: false },
      { $set: { isActive: true } },
      { new: true, runValidators: true },
    );
    if (!service) {
      return res.status(404).json({ message: "Archived service not found." });
    }

    return res.status(200).json({ message: "Service restored.", service });
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
