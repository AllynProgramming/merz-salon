import { useRef, useState } from "react";
import { bookingSchedule } from "../../config/bookingSchedule.js";
import { formatDate, toDateOnly } from "./bookingUtils.js";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DatePicker({ value, onChange, serviceDuration = 30 }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const normalizedValue = toDateOnly(value);
    const selected = normalizedValue
      ? new Date(`${normalizedValue}T00:00:00`)
      : new Date();
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const [clock] = useState(() => new Date());
  const calendarRef = useRef(null);
  const today = new Date(clock);
  today.setHours(0, 0, 0, 0);
  const lastBookableDay = new Date(today);
  lastBookableDay.setDate(
    lastBookableDay.getDate() + bookingSchedule.maximumDaysAhead,
  );
  const openMinute =
    Number(bookingSchedule.openingTime.slice(0, 2)) * 60 +
    Number(bookingSchedule.openingTime.slice(3));
  const closeMinute =
    Number(bookingSchedule.closingTime.slice(0, 2)) * 60 +
    Number(bookingSchedule.closingTime.slice(3));

  const allowed = (date) => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (day < today || day > lastBookableDay) return false;
    if (bookingSchedule.closedWeekdays.includes(day.getDay())) return false;
    if (openMinute + serviceDuration > closeMinute) return false;
    if (day.getTime() === today.getTime()) {
      const firstPossible = Math.ceil(
        (clock.getTime() +
          bookingSchedule.minimumNoticeHours * 3600000 -
          day.getTime()) /
          60000,
      );
      return (
        Math.max(firstPossible, openMinute) + serviceDuration <= closeMinute
      );
    }
    return true;
  };

  const firstWeekday = new Date(viewMonth).getDay();
  const start = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1 - firstWeekday,
  );
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  const moveFocus = (event, currentDate) => {
    const movements = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = movements[event.key];
    if (!step) return;
    event.preventDefault();
    const next = new Date(currentDate);
    next.setDate(next.getDate() + step);
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    const key = dateKey(next);
    requestAnimationFrame(() =>
      calendarRef.current?.querySelector(`[data-date="${key}"]`)?.focus(),
    );
  };

  return (
    <div className="booking-calendar" aria-label="Choose appointment date">
      <div className="booking-calendar-header">
        <button
          type="button"
          className="booking-calendar-nav"
          aria-label="Previous month"
          onClick={() =>
            setViewMonth(
              new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
            )
          }
          disabled={
            viewMonth.getFullYear() === today.getFullYear() &&
            viewMonth.getMonth() === today.getMonth()
          }
        >
          ‹
        </button>
        <h3>
          {new Intl.DateTimeFormat(undefined, {
            month: "long",
            year: "numeric",
          }).format(viewMonth)}
        </h3>
        <button
          type="button"
          className="booking-calendar-nav"
          aria-label="Next month"
          onClick={() =>
            setViewMonth(
              new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
            )
          }
          disabled={
            viewMonth.getFullYear() === lastBookableDay.getFullYear() &&
            viewMonth.getMonth() === lastBookableDay.getMonth()
          }
        >
          ›
        </button>
      </div>
      <div className="booking-calendar-grid" ref={calendarRef}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="booking-calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isToday = key === dateKey(today);
          const isSelected = key === toDateOnly(value);
          return (
            <button
              className={`booking-calendar-day ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
              type="button"
              key={key}
              data-date={key}
              disabled={!allowed(day)}
              aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${isToday ? ", today" : ""}${!allowed(day) ? ", unavailable" : ""}`}
              aria-pressed={isSelected}
              tabIndex={isSelected || (!value && isToday) ? 0 : -1}
              onKeyDown={(event) => moveFocus(event, day)}
              onClick={() => onChange(key)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      <p className="booking-calendar-note">
        Closed Sundays · Book up to {bookingSchedule.maximumDaysAhead} days
        ahead
      </p>
      <p className="booking-calendar-selection" aria-live="polite">
        {value ? formatDate(value) : "Select an available date"}
      </p>
    </div>
  );
}

export default DatePicker;
