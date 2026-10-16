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
  timezone: process.env.SALON_TIMEZONE || "Asia/Manila",
};

export const reminderWindowHours = {
  default: Number(process.env.REMINDER_HOURS_BEFORE || 24),
  secondary: Number(process.env.REMINDER_SECONDARY_HOURS_BEFORE || 2),
};
