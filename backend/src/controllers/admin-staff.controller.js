import { z } from "zod";
import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
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

const staffIdPattern = /^[a-f\d]{24}$/i;

export const listStaff = async (req, res, next) => {
  try {
    const staff = await User.find({ role: "staff" })
      .select("name firstname lastname email workingHours")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      staff: staff.map((member) => ({
        _id: member._id,
        name:
          member.name ||
          [member.firstname, member.lastname].filter(Boolean).join(" ") ||
          member.email,
        email: member.email,
        workingHours: member.workingHours || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStaffWorkingHours = async (req, res, next) => {
  if (!staffIdPattern.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid staff member." });
  }

  const validation = workingHoursSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message:
        validation.error.issues[0]?.message || "Invalid working hours.",
    });
  }

  try {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const assignedAppointments = await Appointment.find({
      staff: req.params.id,
      status: {
        $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED],
      },
      $or: [
        { date: { $gt: today } },
        { date: today, endTime: { $gt: currentTime } },
      ],
    })
      .select("date startTime endTime")
      .lean();
    const proposedHours = new Map(
      validation.data.workingHours.map((hours) => [hours.weekday, hours]),
    );
    const conflict = assignedAppointments.find((appointment) => {
      const weekday = new Date(appointment.date).getUTCDay();
      const workday = proposedHours.get(weekday);
      return (
        !workday?.enabled ||
        appointment.startTime < workday.startTime ||
        appointment.endTime > workday.endTime
      );
    });
    if (conflict) {
      return res.status(409).json({
        message:
          "Working hours conflict with an upcoming assigned appointment. Reassign or adjust that appointment first.",
      });
    }

    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, role: "staff" },
      { $set: { workingHours: validation.data.workingHours } },
      { new: true, runValidators: true },
    )
      .select("name firstname lastname email workingHours")
      .lean();

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    return res.status(200).json({
      message: "Working hours saved.",
      staff: {
        _id: staff._id,
        name:
          staff.name ||
          [staff.firstname, staff.lastname].filter(Boolean).join(" ") ||
          staff.email,
        email: staff.email,
        workingHours: staff.workingHours || [],
      },
    });
  } catch (error) {
    return next(error);
  }
};
