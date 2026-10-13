import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getCalendarDays(month) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstVisibleDay = new Date(firstOfMonth);
  firstVisibleDay.setDate(firstVisibleDay.getDate() - firstVisibleDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay);
    date.setDate(firstVisibleDay.getDate() + index);
    return date;
  });
}

function getWeekDays(date) {
  const firstDay = new Date(date);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return day;
  });
}

async function fetchAppointments(token, from, to) {
  const fetchPage = async (page) => {
    const query = new URLSearchParams({
      from,
      to,
      sort: "date_asc",
      page: String(page),
      limit: "50",
    });
    const response = await fetch(`/api/staff/appointments?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Could not load the schedule.");
    }
    return payload;
  };

  const firstPage = await fetchPage(1);
  const totalPages = Number(firstPage.totalPages) || 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)),
  );

  return [firstPage, ...remainingPages].flatMap(
    (payload) => payload.items || payload.appointments || [],
  );
}

function formatTime(value) {
  if (!value) return "Time to be confirmed";
  const [hours, minutes] = String(value).split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function AdminSchedulePage() {
  const { token } = useAuth();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const calendarDays = getCalendarDays(viewMonth);
  const weekDays = getWeekDays(dateFromKey(selectedDate));
  const rangeStart =
    viewMode === "week" ? dateKey(weekDays[0]) : dateKey(calendarDays[0]);
  const appointmentsByDate = new Map();

  for (const appointment of appointments) {
    const key = String(appointment.date).slice(0, 10);
    const dayAppointments = appointmentsByDate.get(key) || [];
    dayAppointments.push(appointment);
    appointmentsByDate.set(key, dayAppointments);
  }

  const selectedAppointments = appointmentsByDate.get(selectedDate) || [];
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(viewMonth);
  const weekLabel = `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(weekDays[0])} - ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(weekDays[6])}`;
  const selectedDateLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
  }).format(dateFromKey(selectedDate));

  useEffect(() => {
    let active = true;

    async function loadMonth() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const visibleDays =
          viewMode === "week"
            ? getWeekDays(dateFromKey(rangeStart))
            : getCalendarDays(viewMonth);
        const appointmentsForMonth = await fetchAppointments(
          token,
          dateKey(visibleDays[0]),
          dateKey(visibleDays[visibleDays.length - 1]),
        );
        if (active) setAppointments(appointmentsForMonth);
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Could not load the schedule.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMonth();
    return () => {
      active = false;
    };
  }, [token, viewMonth, viewMode, rangeStart, refreshVersion]);

  const changeMonth = (amount) => {
    const nextMonth = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + amount,
      1,
    );
    setViewMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };

  const changeWeek = (amount) => {
    const nextDate = dateFromKey(selectedDate);
    nextDate.setDate(nextDate.getDate() + amount * 7);
    setSelectedDate(dateKey(nextDate));
    setViewMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  };

  const selectDate = (date) => {
    setSelectedDate(dateKey(date));
    if (
      date.getMonth() !== viewMonth.getMonth() ||
      date.getFullYear() !== viewMonth.getFullYear()
    ) {
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const selectToday = () => {
    const currentDate = new Date();
    setSelectedDate(dateKey(currentDate));
    setViewMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );
  };

  const confirmAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    setBusyId(appointmentId);
    setError("");

    try {
      const response = await fetch(`/api/staff/appointments/${appointmentId}/confirm`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Could not confirm this appointment.");
      }
      setRefreshVersion((version) => version + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not confirm this appointment.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="customer-page salon-landing admin-schedule-page">
      <Helmet>
        <title>Admin Schedule | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-dashboard__heading">
          <div>
            <p className="customer-eyebrow">Schedule management</p>
            <h1>Admin Schedule</h1>
            <p className="customer-lede">Appointments arranged by date and time.</p>
          </div>
          <Link className="customer-button customer-button-outline" to="/admin">
            Back to dashboard
          </Link>
        </header>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        <section
          className={`customer-panel admin-schedule__workspace ${viewMode === "week" ? "is-week-view" : ""}`}
        >
          <div className="admin-schedule__calendar">
            <div className="admin-schedule__calendar-header">
              <h2>{viewMode === "month" ? monthLabel : weekLabel}</h2>
              <div className="admin-schedule__month-actions">
                <button
                  type="button"
                  className="admin-schedule__month-nav"
                  aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
                  onClick={() =>
                    viewMode === "month" ? changeMonth(-1) : changeWeek(-1)
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="customer-button customer-button-outline admin-schedule__today"
                  onClick={selectToday}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="admin-schedule__month-nav"
                  aria-label={viewMode === "month" ? "Next month" : "Next week"}
                  onClick={() =>
                    viewMode === "month" ? changeMonth(1) : changeWeek(1)
                  }
                >
                  ›
                </button>
                <div
                  className="admin-schedule__view-toggle"
                  role="group"
                  aria-label="Calendar view"
                >
                  <button
                    className={viewMode === "month" ? "is-active" : ""}
                    type="button"
                    aria-pressed={viewMode === "month"}
                    onClick={() => setViewMode("month")}
                  >
                    Month
                  </button>
                  <button
                    className={viewMode === "week" ? "is-active" : ""}
                    type="button"
                    aria-pressed={viewMode === "week"}
                    onClick={() => setViewMode("week")}
                  >
                    Week
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "month" ? (
              <div
                className="admin-schedule__calendar-grid"
                aria-label="Appointment calendar"
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (weekday) => (
                    <span className="admin-schedule__weekday" key={weekday}>
                      {weekday}
                    </span>
                  ),
                )}
                {calendarDays.map((date) => {
                  const key = dateKey(date);
                  const dayAppointments = appointmentsByDate.get(key) || [];
                  const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
                  const isToday = key === dateKey(new Date());
                  const isSelected = key === selectedDate;

                  return (
                    <button
                      className={`admin-schedule__day ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                      type="button"
                      key={key}
                      aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date)}, ${dayAppointments.length} appointments`}
                      aria-pressed={isSelected}
                      onClick={() => selectDate(date)}
                    >
                      <span>{date.getDate()}</span>
                      {dayAppointments.length > 0 && (
                        <small>{dayAppointments.length}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="admin-schedule__week" aria-label="Appointments this week">
                {weekDays.map((date) => {
                  const key = dateKey(date);
                  const dayAppointments = appointmentsByDate.get(key) || [];
                  const isToday = key === dateKey(new Date());

                  return (
                    <section
                      className={`admin-schedule__week-day ${isToday ? "is-today" : ""}`}
                      key={key}
                      aria-labelledby={`week-day-${key}`}
                    >
                      <header className="admin-schedule__week-day-header">
                        <div>
                          <h3 id={`week-day-${key}`}>
                            {new Intl.DateTimeFormat(undefined, {
                              weekday: "long",
                            }).format(date)}
                          </h3>
                          <span>
                            {new Intl.DateTimeFormat(undefined, {
                              month: "long",
                              day: "numeric",
                            }).format(date)}
                          </span>
                        </div>
                        <span>
                          {dayAppointments.length} {dayAppointments.length === 1 ? "appointment" : "appointments"}
                        </span>
                      </header>
                      {dayAppointments.length === 0 ? (
                        <p className="admin-schedule__week-empty">
                          No appointments
                        </p>
                      ) : (
                        <div className="admin-schedule__list">
                          {dayAppointments.map((appointment) => (
                            <article
                              key={appointment._id}
                              className="admin-schedule__appointment"
                            >
                              <div className="admin-schedule__appointment-time">
                                <strong>{formatTime(appointment.startTime)}</strong>
                                {appointment.endTime && (
                                  <span>Until {formatTime(appointment.endTime)}</span>
                                )}
                              </div>
                              <div className="admin-schedule__appointment-details">
                                <strong>
                                  {appointment.serviceName || "Salon service"}
                                </strong>
                                <span>
                                  {appointment.customerName || "Customer"}
                                </span>
                              </div>
                              <div className="admin-schedule__appointment-actions">
                                <StatusBadge status={appointment.status} />
                                {appointment.status === "pending" && (
                                  <button
                                    type="button"
                                    className="customer-button customer-button-primary"
                                    onClick={() =>
                                      confirmAppointment(appointment._id)
                                    }
                                    disabled={busyId === appointment._id}
                                  >
                                    {busyId === appointment._id
                                      ? "Confirming..."
                                      : "Confirm"}
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
            <p className="admin-schedule__calendar-note" aria-live="polite">
              {loading
                ? "Updating appointments..."
                : `${appointments.length} appointments shown`}
            </p>
          </div>

          {viewMode === "month" && (
            <div className="admin-schedule__agenda">
            <div className="customer-panel-header admin-schedule__agenda-header">
              <div>
                <p className="customer-eyebrow">Daily agenda</p>
                <h2>{selectedDateLabel}</h2>
              </div>
              <span>{selectedAppointments.length} bookings</span>
            </div>

            {loading ? (
              <p role="status">Loading appointments...</p>
            ) : selectedAppointments.length === 0 ? (
              <p className="customer-empty-state">
                No appointments scheduled for this date.
              </p>
            ) : (
              <div className="admin-schedule__list">
                {selectedAppointments.map((appointment) => (
                  <article
                    key={appointment._id}
                    className="admin-schedule__appointment"
                  >
                    <div className="admin-schedule__appointment-time">
                      <strong>{formatTime(appointment.startTime)}</strong>
                      {appointment.endTime && (
                        <span>Until {formatTime(appointment.endTime)}</span>
                      )}
                    </div>
                    <div className="admin-schedule__appointment-details">
                      <strong>{appointment.serviceName || "Salon service"}</strong>
                      <span>{appointment.customerName || "Customer"}</span>
                    </div>
                    <div className="admin-schedule__appointment-actions">
                      <StatusBadge status={appointment.status} />
                      {appointment.status === "pending" && (
                        <button
                          type="button"
                          className="customer-button customer-button-primary"
                          onClick={() => confirmAppointment(appointment._id)}
                          disabled={busyId === appointment._id}
                        >
                          {busyId === appointment._id ? "Confirming..." : "Confirm"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminSchedulePage;
