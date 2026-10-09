export function formatDuration(minutes) {
  const hours = Math.floor(Number(minutes) / 60);
  const remainder = Number(minutes) % 60;
  if (hours && remainder) return `${hours} hr ${remainder} min`;
  if (hours) return `${hours} hr`;
  return `${remainder} min`;
}

export function formatPrice(price) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
}

export function toDateOnly(value) {
  const dateOnly = String(value || "").slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ||
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return dateOnly;
}

export function formatDate(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "Choose a date";
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(
    new Date(year, month - 1, day),
  );
}

export function formatTime(value) {
  if (!value) return "Choose a time";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}
