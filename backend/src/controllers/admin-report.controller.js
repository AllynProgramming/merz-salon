
import Appointment from "../models/appointment.model.js";
import IntegrationSettings from "../models/integrationSettings.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";
import { createReportPdf } from "../services/report-pdf.service.js";
import { uploadReportToGoogleDrive } from "../services/google-drive.service.js";

const dateValue = (date) => date.toISOString().slice(0, 10);
const startOfDay = (value) => new Date(`${value}T00:00:00.000Z`);
const nextDay = (value) => startOfDay(value).getTime() + 86400000;

const ensurePdfReportsEnabled = async () => {
  const settings = await IntegrationSettings.findOne({ key: "default" })
    .select("pdfReports")
    .lean();
  if (settings?.pdfReports === false) {
    const error = new Error("PDF report generation is disabled in Admin Settings.");
    error.statusCode = 403;
    throw error;
  }
};

const resolvePeriod = (query) => {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  return {
    from: query.from || dateValue(defaultFrom),
    to: query.to || dateValue(today),
  };
};

export const buildAdminReport = async (query) => {
  const period = resolvePeriod(query);
  const dateFilter = {
    $gte: startOfDay(period.from),
    $lt: new Date(nextDay(period.to)),
  };
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
                $cond: [{ $eq: ["$status", APPOINTMENT_STATUS.COMPLETED] }, 1, 0],
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
            unpricedCompleted: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", APPOINTMENT_STATUS.COMPLETED] },
                      { $eq: ["$priceSnapshot", null] },
                    ],
                  },
                  1,
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
            unpricedCompleted: 1,
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
                { $concat: ["$customer.firstname", " ", "$customer.lastname"] },
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
  const settings = await IntegrationSettings.findOne({ key: "default" })
    .select("pdfReports")
    .lean();

  return {
    period,
    pdfReportsEnabled: settings?.pdfReports !== false,
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
  };
};

export const getAdminReport = async (req, res, next) => {
  try {
    return res.status(200).json(await buildAdminReport(req.query));
  } catch (error) {
    return next(error);
  }
};

const getFilename = (report) => `merz-report-${report.period.from}-to-${report.period.to}.pdf`;

export const downloadAdminReport = async (req, res, next) => {
  try {
    await ensurePdfReportsEnabled();
    const report = await buildAdminReport(req.query);
    const pdf = await createReportPdf(report);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${getFilename(report)}"`,
      "Content-Length": pdf.length,
    });
    return res.send(pdf);
  } catch (error) {
    return next(error);
  }
};

export const uploadAdminReport = async (req, res, next) => {
  try {
    await ensurePdfReportsEnabled();
    const report = await buildAdminReport(req.query);
    const pdf = await createReportPdf(report);
    const file = await uploadReportToGoogleDrive({
      filename: getFilename(report),
      pdf,
    });
    return res.status(201).json({ file });
  } catch (error) {
    return next(error);
  }
};
