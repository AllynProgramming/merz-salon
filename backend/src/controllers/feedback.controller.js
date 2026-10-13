import { z } from "zod";

import Feedback from "../models/feedback.model.js";
import Appointment from "../models/appointment.model.js";
import Service from "../models/service.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";
import { createAppointmentNotifications } from "../services/notification.service.js";

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

const sanitizeComment = (value = "") => {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const feedbackEditWindowDays = () => {
  const configuredDays = Number.parseInt(
    process.env.FEEDBACK_EDIT_DAYS || "7",
    10,
  );
  return Number.isInteger(configuredDays) && configuredDays > 0
    ? configuredDays
    : 7;
};

const refreshServiceRating = async (serviceId) => {
  const [summary] = await Feedback.aggregate([
    { $match: { service: serviceId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  await Service.findByIdAndUpdate(serviceId, {
    averageRating: summary ? Number(summary.averageRating.toFixed(1)) : 0,
    ratingCount: summary ? summary.ratingCount : 0,
  });
};

export const createFeedback = async (req, res, next) => {
  const validation = feedbackSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid feedback details.",
    });
  }

  try {
    const { appointmentId, rating, comment } = validation.data;
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      customer: req.user.id,
    }).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
      return res.status(403).json({
        message: "Feedback can only be left after a completed appointment.",
      });
    }

    const existing = await Feedback.findOne({
      appointment: appointmentId,
      customer: req.user.id,
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "This appointment has already been reviewed." });
    }

    const sanitizedComment = sanitizeComment(comment);
    const feedback = await Feedback.create({
      appointment: appointmentId,
      customer: req.user.id,
      service: appointment.service,
      rating,
      comment: sanitizedComment,
    });

    await refreshServiceRating(appointment.service);
    try {
      await createAppointmentNotifications({
        appointment,
        type: "feedback_received",
        title: "Feedback received",
        message: "Thank you for sharing your salon experience.",
      });
    } catch (notificationError) {
      console.error(
        "Could not create feedback notification:",
        notificationError.message,
      );
    }

    return res.status(201).json({
      message: "Thank you for your feedback.",
      feedback,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "This appointment has already been reviewed." });
    }
    return next(error);
  }
};

export const getMyFeedback = async (req, res, next) => {
  try {
    const items = await Feedback.find({ customer: req.user.id })
      .populate("service", "name")
      .populate("appointment", "date startTime endTime status")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ items });
  } catch (error) {
    return next(error);
  }
};

export const getAdminFeedback = async (req, res, next) => {
  try {
    const [items, summaries] = await Promise.all([
      Feedback.find({})
        .populate("customer", "name firstname lastname")
        .populate("service", "name averageRating ratingCount")
        .populate("appointment", "date startTime endTime status")
        .sort({ createdAt: -1 })
        .lean(),
      Feedback.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ]),
    ]);
    const summary = summaries[0];

    return res.status(200).json({
      items,
      summary: {
        averageRating: summary
          ? Number(summary.averageRating.toFixed(1))
          : null,
        ratingCount: summary?.ratingCount || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getFeedbackForAppointment = async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid appointment id." });
  }

  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user.id,
    }).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    const feedback = await Feedback.findOne({
      appointment: appointment._id,
      customer: req.user.id,
    }).lean();

    return res.status(200).json({ feedback });
  } catch (error) {
    return next(error);
  }
};

export const updateFeedback = async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid feedback id." });
  }
  const feedbackId = req.params.id;
  const validation = feedbackUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid feedback update.",
    });
  }

  try {
    const feedback = await Feedback.findOne({
      _id: feedbackId,
      customer: req.user.id,
    });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found." });
    }

    const createdAt = new Date(feedback.createdAt).getTime();
    const windowMs = feedbackEditWindowDays() * 24 * 60 * 60 * 1000;
    if (Date.now() - createdAt > windowMs) {
      return res
        .status(403)
        .json({ message: "This feedback can no longer be edited." });
    }

    if (validation.data.rating) feedback.rating = validation.data.rating;
    if (validation.data.comment !== undefined) {
      feedback.comment = sanitizeComment(validation.data.comment);
    }

    await feedback.save();
    await refreshServiceRating(feedback.service);

    return res.status(200).json({ message: "Feedback updated.", feedback });
  } catch (error) {
    return next(error);
  }
};
