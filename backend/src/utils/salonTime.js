import { salonSchedule } from "../config/schedule.js";

export const getSalonClock = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: salonSchedule.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

export const hasPassedConfirmationDeadline = ({
  appointmentDate,
  startTime,
  salonNow,
}) => {
  const appointmentStart = new Date(
    `${String(appointmentDate).slice(0, 10)}T${startTime}:00.000Z`,
  );
  if (Number.isNaN(appointmentStart.getTime())) {
    throw new Error("Cannot determine the appointment confirmation deadline.");
  }

  const deadline = new Date(
    appointmentStart.getTime() +
      salonSchedule.appointmentConfirmationGraceMinutes * 60_000,
  );
  const deadlineDate = deadline.toISOString().slice(0, 10);
  const deadlineMinutes =
    deadline.getUTCHours() * 60 + deadline.getUTCMinutes();

  return (
    salonNow.date > deadlineDate ||
    (salonNow.date === deadlineDate && salonNow.minutes >= deadlineMinutes)
  );
};
