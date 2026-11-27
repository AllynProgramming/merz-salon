export const staffRoleOptions = [
  {
    value: "staff",
    label: "Staff",
    description: "Appointments and day-to-day schedule work.",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Staff workspace with expanded operational responsibility.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full control, including team accounts and settings.",
  },
];

export const staffRoleLabel = (role) =>
  staffRoleOptions.find((option) => option.value === role)?.label || "Staff";

export const emptyStaffForm = { name: "", email: "", phone: "", role: "staff" };

export const toStaffForm = (member) => ({
  name: member.name || "",
  email: member.email || "",
  phone: member.phone || "",
  role: member.role || "staff",
});

export const toStaffPayload = (form) => ({
  name: form.name.trim(),
  email: form.email.trim(),
  phone: form.phone.trim(),
  role: form.role,
});

export const isStaffFormDirty = (form, initial) =>
  Object.keys(emptyStaffForm).some((key) => form[key] !== initial[key]);
