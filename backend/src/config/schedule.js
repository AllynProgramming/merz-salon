const configuredConfirmationGraceMinutes = Number(
  process.env.APPOINTMENT_CONFIRMATION_GRACE_MINUTES,
);

export const salonSchedule = {
  openingTime: process.env.SALON_OPENING_TIME || "09:00",
  closingTime: process.env.SALON_CLOSING_TIME || "18:00",
  slotIntervalMinutes: Number(process.env.SALON_SLOT_INTERVAL || 30),
  closedWeekdays: (process.env.SALON_CLOSED_WEEKDAYS || "0")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value)),
  maximumDaysAhead: Number(process.env.SALON_MAX_DAYS_AHEAD || 30),
  minimumNoticeHours: Number(process.env.SALON_MIN_NOTICE_HOURS || 2),
  appointmentConfirmationGraceMinutes:
    Number.isFinite(configuredConfirmationGraceMinutes) &&
    configuredConfirmationGraceMinutes >= 0
      ? configuredConfirmationGraceMinutes
      : 15,
  timezone: process.env.SALON_TIMEZONE || "Asia/Manila",
};

export const getDefaultWorkingHours = () =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    enabled: !salonSchedule.closedWeekdays.includes(weekday),
    startTime: salonSchedule.openingTime,
    endTime: salonSchedule.closingTime,
  }));

export const reminderWindowHours = {
  default: Number(process.env.REMINDER_HOURS_BEFORE || 24),
  secondary: Number(process.env.REMINDER_SECONDARY_HOURS_BEFORE || 2),
};
