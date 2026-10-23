import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import StaffNotificationBell from "../components/auth/StaffNotificationBell.jsx";
import { cancelStaffAppointment } from "../services/bookingApi.js";
import { formatPrice } from "../components/booking/bookingUtils.js";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import StaffRescheduleDialog from "../components/booking/StaffRescheduleDialog.jsx";
import { getDashboardPath } from "../utils/accountRole.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import "../styles/staff-reschedule.css";

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

function AppointmentMeta({ appointment, id }) {
  return (
    <dl className="admin-schedule__appointment-meta" id={id}>
      <div>
        <dt>Price</dt>
        <dd>{formatPrice(appointment.price)}</dd>
      </div>
      <div>
        <dt>Booking reference</dt>
        <dd>{appointment.bookingReference || appointment._id}</dd>
      </div>
    </dl>
  );
}

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function defaultWorkingHours() {
  return weekdayNames.map((_, weekday) => ({
    weekday,
    enabled: weekday !== 0,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

function workingHoursForStaff(member) {
  const savedHours = new Map(
    (member?.workingHours || []).map((hours) => [hours.weekday, hours]),
  );
  return defaultWorkingHours().map(
    (hours) => savedHours.get(hours.weekday) || hours,
  );
}

async function fetchStaff(token) {
  const response = await fetch("/api/admin/staff", {
    headers: { Authorization: ["Bearer", token].join(" ") },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Could not load staff members.");
  }
  return payload.staff || [];
}

function AdminSchedulePage() {
  const { token, user } = useAuth();
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
  const [busyAction, setBusyAction] = useState("");
  const [detailsAppointmentId, setDetailsAppointmentId] = useState("");
  const [reschedulingAppointment, setReschedulingAppointment] = useState(null);
  const [assigningId, setAssigningId] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(user?.role === "admin");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [workingHours, setWorkingHours] = useState(defaultWorkingHours);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
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

  useEffect(() => {
    if (user?.role !== "admin" || !token) return undefined;
    let active = true;
    fetchStaff(token)
      .then((members) => {
        if (active) {
          const initialStaffId = members[0]?._id || "";
          setStaff(members);
          setSelectedStaffId(initialStaffId);
          setWorkingHours(
            workingHoursForStaff(
              members.find((member) => member._id === initialStaffId),
            ),
          );
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Could not load staff members.");
        }
      })
      .finally(() => {
        if (active) setStaffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, user?.role]);

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
    setBusyAction("confirm");
    setError("");

    try {
      const response = await fetch(
        `/api/staff/appointments/${appointmentId}/confirm`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message || "Could not confirm this appointment.",
        );
      }
      setRefreshVersion((version) => version + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not confirm this appointment.");
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  };

  const cancelAppointment = async (appointmentId) => {
    if (
      !appointmentId ||
      !window.confirm("Cancel this appointment? The customer will be notified.")
    ) {
      return;
    }
    setBusyId(appointmentId);
    setBusyAction("cancel");
    setError("");

    try {
      await cancelStaffAppointment(appointmentId, token);
      setRefreshVersion((version) => version + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not cancel this appointment.");
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  };

  const finishReschedule = () => {
    setReschedulingAppointment(null);
    setRefreshVersion((version) => version + 1);
  };

  const assignStaff = async (appointmentId, staffId) => {
    setAssigningId(appointmentId);
    setError("");
    try {
      const response = await fetch(
        `/api/staff/appointments/${appointmentId}/assign`,
        {
          method: "PATCH",
          headers: {
            Authorization: ["Bearer", token].join(" "),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ staffId: staffId || null }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message || "Could not assign this appointment.",
        );
      }
      setAppointments((current) =>
        current.map((appointment) =>
          appointment._id === appointmentId
            ? {
                ...appointment,
                staffId: payload.staffId,
                staffName: payload.staffName,
              }
            : appointment,
        ),
      );
    } catch (requestError) {
      setError(requestError.message || "Could not assign this appointment.");
    } finally {
      setAssigningId("");
    }
  };

  const updateWorkingHour = (weekday, updates) => {
    setWorkingHours((current) =>
      current.map((hours) =>
        hours.weekday === weekday ? { ...hours, ...updates } : hours,
      ),
    );
  };

  const selectStaff = (staffId) => {
    setSelectedStaffId(staffId);
    setHoursSaved(false);
    setWorkingHours(
      workingHoursForStaff(staff.find((member) => member._id === staffId)),
    );
  };

  const saveWorkingHours = async (event) => {
    event.preventDefault();
    if (!selectedStaffId) return;
    setSavingHours(true);
    setError("");
    setHoursSaved(false);
    try {
      const response = await fetch(
        `/api/admin/staff/${selectedStaffId}/working-hours`,
        {
          method: "PUT",
          headers: {
            Authorization: ["Bearer", token].join(" "),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workingHours }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Could not save working hours.");
      }
      setStaff((current) =>
        current.map((member) =>
          member._id === selectedStaffId ? payload.staff : member,
        ),
      );
      setHoursSaved(true);
    } catch (requestError) {
      setError(requestError.message || "Could not save working hours.");
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <div className="customer-page salon-landing admin-schedule-page">
      <Helmet>
        <title>Manage Schedule | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-section-heading">
          <div>
            <p className="customer-eyebrow">Schedule management</p>
            <h1>Manage Schedule</h1>
            <p className="customer-lede">
              Appointments arranged by date and time.
            </p>
          </div>
          <div className="admin-schedule__heading-actions">
            <StaffNotificationBell />
            <Link
              className="customer-button customer-button-outline"
              to={getDashboardPath(user?.role) || "/"}
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {["staff", "admin"].includes(user?.role) && (
          <p className="admin-schedule__staff-note">
            You can cancel pending or confirmed appointments before their
            scheduled start time. Pending bookings stay held briefly after their
            start while you confirm them. Customers are notified when you
            cancel.
          </p>
        )}

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        {user?.role === "admin" && (
          <section
            className="customer-panel admin-schedule__hours-panel"
            aria-labelledby="admin-schedule-hours-heading"
          >
            <div className="customer-panel-header">
              <div>
                <h2 id="admin-schedule-hours-heading">Staff working hours</h2>
                <p>
                  Set each team member's weekly availability before assigning
                  appointments.
                </p>
              </div>
              {staffLoading && <span role="status">Loading staff...</span>}
            </div>
            {staff.length === 0 && !staffLoading ? (
              <p className="customer-empty-state">
                No staff accounts found. Create staff accounts before setting
                their availability.
              </p>
            ) : (
              <form
                className="admin-schedule__hours-form"
                onSubmit={saveWorkingHours}
              >
                <label className="admin-schedule__staff-select">
                  <span>Staff member</span>
                  <select
                    value={selectedStaffId}
                    onChange={(event) => selectStaff(event.target.value)}
                    disabled={staffLoading || staff.length === 0}
                  >
                    {staff.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-schedule__hours-list">
                  {workingHours.map((hours) => (
                    <div
                      className="admin-schedule__hours-row"
                      key={hours.weekday}
                    >
                      <label className="admin-schedule__hours-day">
                        <input
                          type="checkbox"
                          checked={hours.enabled}
                          onChange={(event) =>
                            updateWorkingHour(hours.weekday, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        <span>{weekdayNames[hours.weekday]}</span>
                      </label>
                      <label className="admin-schedule__time-field">
                        <span className="admin-dashboard__visually-hidden">
                          {weekdayNames[hours.weekday]} start time
                        </span>
                        <input
                          type="time"
                          value={hours.startTime}
                          disabled={!hours.enabled}
                          onChange={(event) =>
                            updateWorkingHour(hours.weekday, {
                              startTime: event.target.value,
                            })
                          }
                        />
                      </label>
                      <span className="admin-schedule__time-separator">to</span>
                      <label className="admin-schedule__time-field">
                        <span className="admin-dashboard__visually-hidden">
                          {weekdayNames[hours.weekday]} end time
                        </span>
                        <input
                          type="time"
                          value={hours.endTime}
                          disabled={!hours.enabled}
                          onChange={(event) =>
                            updateWorkingHour(hours.weekday, {
                              endTime: event.target.value,
                            })
                          }
                        />
                      </label>
                      {!hours.enabled && (
                        <span className="admin-schedule__day-off">Day off</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  className="customer-button customer-button-primary"
                  type="submit"
                  disabled={savingHours || !selectedStaffId}
                >
                  {savingHours ? "Saving hours..." : "Save working hours"}
                </button>
                {hoursSaved && (
                  <p className="admin-schedule__hours-saved" role="status">
                    Working hours saved.
                  </p>
                )}
              </form>
            )}
          </section>
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
                  aria-label={
                    viewMode === "month" ? "Previous month" : "Previous week"
                  }
                  onClick={() =>
                    viewMode === "month" ? changeMonth(-1) : changeWeek(-1)
                  }
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
                    <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
                  </svg>
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
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
                    <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
                  </svg>
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
                  const isCurrentMonth =
                    date.getMonth() === viewMonth.getMonth();
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
              <div
                className="admin-schedule__week"
                aria-label="Appointments this week"
              >
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
                          {dayAppointments.length}{" "}
                          {dayAppointments.length === 1
                            ? "appointment"
                            : "appointments"}
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
                                <strong>
                                  {formatTime(appointment.startTime)}
                                </strong>
                                {appointment.endTime && (
                                  <span>
                                    Until {formatTime(appointment.endTime)}
                                  </span>
                                )}
                              </div>
                              <div className="admin-schedule__appointment-details">
                                <strong>
                                  {appointment.serviceName || "Salon service"}
                                </strong>
                                <span>
                                  {appointment.customerName || "Customer"}
                                </span>
                                {appointment.staffName && (
                                  <span>Staff: {appointment.staffName}</span>
                                )}
                              </div>
                              <div className="admin-schedule__appointment-actions">
                                <StatusBadge status={appointment.status} />
                                <button
                                  type="button"
                                  className="customer-button customer-button-outline admin-schedule__details-toggle"
                                  aria-expanded={
                                    detailsAppointmentId === appointment._id
                                  }
                                  aria-controls={`appointment-meta-${appointment._id}`}
                                  onClick={() =>
                                    setDetailsAppointmentId((currentId) =>
                                      currentId === appointment._id
                                        ? ""
                                        : appointment._id,
                                    )
                                  }
                                >
                                  {detailsAppointmentId === appointment._id
                                    ? "Hide details"
                                    : "Details"}
                                </button>
                                {appointment.canStaffCancel && (
                                  <button
                                    type="button"
                                    className="customer-button customer-button-outline admin-schedule__reschedule"
                                    onClick={() =>
                                      setReschedulingAppointment(appointment)
                                    }
                                  >
                                    Reschedule
                                  </button>
                                )}
                                {user?.role === "admin" && (
                                  <select
                                    className="admin-schedule__assign-select"
                                    aria-label={`Assign staff for ${appointment.customerName || "appointment"} at ${formatTime(appointment.startTime)}`}
                                    value={appointment.staffId || ""}
                                    disabled={
                                      assigningId === appointment._id ||
                                      staff.length === 0 ||
                                      !["pending", "confirmed"].includes(
                                        appointment.status,
                                      )
                                    }
                                    onChange={(event) =>
                                      assignStaff(
                                        appointment._id,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">Unassigned</option>
                                    {staff.map((member) => (
                                      <option
                                        key={member._id}
                                        value={member._id}
                                      >
                                        {member.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {appointment.status === "pending" &&
                                  (user?.role === "admin" ||
                                    !appointment.staffId ||
                                    appointment.staffId === user?._id) && (
                                    <button
                                      type="button"
                                      className="customer-button customer-button-primary"
                                      onClick={() =>
                                        confirmAppointment(appointment._id)
                                      }
                                      disabled={busyId === appointment._id}
                                    >
                                      {busyId === appointment._id &&
                                      busyAction === "confirm"
                                        ? "Confirming..."
                                        : "Confirm"}
                                    </button>
                                  )}
                                {appointment.canStaffCancel && (
                                  <button
                                    type="button"
                                    className="customer-button customer-button-outline admin-schedule__cancel"
                                    onClick={() =>
                                      cancelAppointment(appointment._id)
                                    }
                                    disabled={busyId === appointment._id}
                                  >
                                    {busyId === appointment._id &&
                                    busyAction === "cancel"
                                      ? "Cancelling..."
                                      : "Cancel"}
                                  </button>
                                )}
                              </div>
                              {detailsAppointmentId === appointment._id && (
                                <AppointmentMeta
                                  appointment={appointment}
                                  id={`appointment-meta-${appointment._id}`}
                                />
                              )}
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
                        <strong>
                          {appointment.serviceName || "Salon service"}
                        </strong>
                        <span>{appointment.customerName || "Customer"}</span>
                        {appointment.staffName && (
                          <span>Staff: {appointment.staffName}</span>
                        )}
                      </div>
                      <div className="admin-schedule__appointment-actions">
                        <StatusBadge status={appointment.status} />
                        <button
                          type="button"
                          className="customer-button customer-button-outline admin-schedule__details-toggle"
                          aria-expanded={
                            detailsAppointmentId === appointment._id
                          }
                          aria-controls={`appointment-meta-${appointment._id}`}
                          onClick={() =>
                            setDetailsAppointmentId((currentId) =>
                              currentId === appointment._id
                                ? ""
                                : appointment._id,
                            )
                          }
                        >
                          {detailsAppointmentId === appointment._id
                            ? "Hide details"
                            : "Details"}
                        </button>
                        {["pending", "confirmed"].includes(
                          appointment.status,
                        ) && (
                          <button
                            type="button"
                            className="customer-button customer-button-outline admin-schedule__reschedule"
                            onClick={() =>
                              setReschedulingAppointment(appointment)
                            }
                          >
                            Reschedule
                          </button>
                        )}
                        {user?.role === "admin" && (
                          <select
                            className="admin-schedule__assign-select"
                            aria-label={`Assign staff for ${appointment.customerName || "appointment"} at ${formatTime(appointment.startTime)}`}
                            value={appointment.staffId || ""}
                            disabled={
                              assigningId === appointment._id ||
                              staff.length === 0 ||
                              !["pending", "confirmed"].includes(
                                appointment.status,
                              )
                            }
                            onChange={(event) =>
                              assignStaff(appointment._id, event.target.value)
                            }
                          >
                            <option value="">Unassigned</option>
                            {staff.map((member) => (
                              <option key={member._id} value={member._id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {appointment.status === "pending" &&
                          (user?.role === "admin" ||
                            !appointment.staffId ||
                            appointment.staffId === user?._id) && (
                            <button
                              type="button"
                              className="customer-button customer-button-primary"
                              onClick={() =>
                                confirmAppointment(appointment._id)
                              }
                              disabled={busyId === appointment._id}
                            >
                              {busyId === appointment._id &&
                              busyAction === "confirm"
                                ? "Confirming..."
                                : "Confirm"}
                            </button>
                          )}
                        {["pending", "confirmed"].includes(
                          appointment.status,
                        ) && (
                          <button
                            type="button"
                            className="customer-button customer-button-outline admin-schedule__cancel"
                            onClick={() => cancelAppointment(appointment._id)}
                            disabled={busyId === appointment._id}
                          >
                            {busyId === appointment._id &&
                            busyAction === "cancel"
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        )}
                      </div>
                      {detailsAppointmentId === appointment._id && (
                        <AppointmentMeta
                          appointment={appointment}
                          id={`appointment-meta-${appointment._id}`}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      {reschedulingAppointment && (
        <StaffRescheduleDialog
          appointment={reschedulingAppointment}
          token={token}
          onClose={() => setReschedulingAppointment(null)}
          onRescheduled={finishReschedule}
        />
      )}
    </div>
  );
}

export default AdminSchedulePage;
