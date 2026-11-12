import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import Appointment from "../models/appointment.model.js";
import User from "../models/user.model.js";
import { APPOINTMENT_STATUS } from "../constants/appointmentStatus.js";

const staffIdPattern = /^[a-f\d]{24}$/i;

export const createStaff = async (req, res, next) => {
  const { name, phone, role } = req.body;
  const email = req.body.email.toLowerCase();
  const [firstname, ...lastname] = name.split(/\s+/);
  const temporaryPassword = `Merz-${crypto.randomBytes(6).toString("base64url")}`;

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }, { phoneNumber: phone }],
    });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
    const staff = await User.create({
      name,
      firstname,
      lastname: lastname.join(" "),
      email,
      phone,
      phoneNumber: phone,
      password: hashedPassword,
      mustChangePassword: true,
      role,
    });

    return res.status(201).json({
      message: "Staff account created.",
      temporaryPassword,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        workingHours: staff.workingHours || [],
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists.",
      });
    }
    return next(error);
  }
};

export const listStaff = async (req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: ["staff", "manager", "admin"] } })
      .select("name firstname lastname email phone phoneNumber role workingHours")
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
        phone: member.phone || member.phoneNumber || "",
        role: member.role,
        workingHours: member.workingHours || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  if (!staffIdPattern.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid staff member." });
  }

  const { name, email: submittedEmail, phone, role, resetPassword } =
    req.body;
  const email = submittedEmail?.toLowerCase();
  const temporaryPassword = resetPassword
    ? `Merz-${crypto.randomBytes(6).toString("base64url")}`
    : null;

  try {
    const duplicatePhone = phone
      ? await User.findOne({
          _id: { $ne: req.params.id },
          $or: [{ phone }, { phoneNumber: phone }],
        })
      : null;
    if (duplicatePhone) {
      return res.status(409).json({
        message: "An account with this phone number already exists.",
      });
    }
    const duplicateEmail = email
      ? await User.findOne({
          _id: { $ne: req.params.id },
          email,
        })
      : null;
    if (duplicateEmail) {
      return res.status(409).json({
        message: "An account with this email address already exists.",
      });
    }

    const updates = {};
    if (name !== undefined) {
      const [firstname, ...lastname] = name.split(/\s+/);
      updates.name = name;
      updates.firstname = firstname;
      updates.lastname = lastname.join(" ");
    }
    if (phone !== undefined) {
      updates.phone = phone;
      updates.phoneNumber = phone;
    }
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (temporaryPassword) {
      updates.password = await bcrypt.hash(temporaryPassword, 12);
      updates.mustChangePassword = true;
    }

    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ["staff", "manager", "admin"] } },
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select(
        "name firstname lastname email phone phoneNumber role workingHours mustChangePassword",
      )
      .lean();

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    return res.status(200).json({
      message: "Staff account updated.",
      temporaryPassword,
      staff: {
        _id: staff._id,
        name:
          staff.name ||
          [staff.firstname, staff.lastname].filter(Boolean).join(" ") ||
          staff.email,
        email: staff.email,
        phone: staff.phone || staff.phoneNumber || "",
        role: staff.role,
        mustChangePassword: Boolean(staff.mustChangePassword),
        workingHours: staff.workingHours || [],
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists.",
      });
    }
    return next(error);
  }
};

export const updateStaffWorkingHours = async (req, res, next) => {
  if (!staffIdPattern.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid staff member." });
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
      req.body.workingHours.map((hours) => [hours.weekday, hours]),
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
      { _id: req.params.id, role: { $in: ["staff", "manager", "admin"] } },
      { $set: { workingHours: req.body.workingHours } },
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
