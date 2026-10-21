import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import useAuth from "../context/useAuth.js";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";

function formatTime(value) {
  if (!value) return "Time to be confirmed";
  const [hours, minutes] = String(value).split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchTodayAppointments(token, date) {
  const fetchPage = async (page) => {
    const query = new URLSearchParams({
      from: date,
      to: date,
      sort: "date_asc",
      page: String(page),
      limit: "50",
    });
    const response = await fetch(`/api/staff/appointments?${query}`, {
      headers: { Authorization: ["Bearer", token].join(" ") },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload.message || "Could not load today's appointments.",
      );
    }
    return payload;
  };

  const firstPage = await fetchPage(1);
  const totalPages = Number(firstPage.totalPages) || 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)),
  );

  return {
    appointments: [firstPage, ...remainingPages].flatMap(
      (payload) => payload.items || payload.appointments || [],
    ),
  };
}

function AdminDashboardPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", {
        replace: true,
        state: { notice: "You've been logged out." },
      });
    }
  };

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/staff/appointments?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Could not load appointments.");
        }
        const todayResult = await fetchTodayAppointments(
          token,
          dateKey(new Date()),
        );
        if (active) {
          setAppointments(todayResult.appointments);
          setStatusCounts(payload.statusCounts || {});
        }
      } catch (requestError) {
        if (active)
          setError(requestError.message || "Could not load appointments.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) loadAppointments();
    return () => {
      active = false;
    };
  }, [token]);

  const totalCount = Object.values(statusCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const customerCount = new Set(
    appointments.map((appointment) => appointment.customerId).filter(Boolean),
  ).size;
  const serviceCount = new Set(
    appointments.map(
      (appointment) => appointment.service?._id || appointment.serviceName,
    ),
  ).size;
  const searchTerm = search.trim().toLocaleLowerCase();
  const visibleAppointments = appointments.filter((appointment) => {
    const matchesStatus =
      statusFilter === "all" || appointment.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      `${appointment.customerName || ""} ${appointment.serviceName || ""}`
        .toLocaleLowerCase()
        .includes(searchTerm);
    return matchesStatus && matchesSearch;
  });
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
  }).format(new Date());

  return (
    <div className="customer-page salon-landing admin-dashboard-page">
      <Helmet>
        <title>
          {`${user?.role === "admin" ? "Admin Dashboard" : "Staff Dashboard"} | MERZ Beauty Salon`}
        </title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-dashboard__heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>
              {user?.role === "admin" ? "Admin Dashboard" : "Staff Dashboard"}
            </h1>
            <p className="customer-lede">
              Welcome back, {user?.name || user?.firstname || "Team member"}.
              Here’s the latest appointment overview.
            </p>
          </div>
          <div className="admin-dashboard__heading-actions">
            <Link
              className="customer-button customer-button-outline admin-dashboard__manage"
              to="/admin/schedule"
            >
              Manage Schedule
            </Link>
            {user?.role === "admin" && (
              <Link
                className="customer-button customer-button-outline admin-dashboard__manage"
                to="/admin/staff"
              >
                Staff Accounts
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                className="customer-button customer-button-outline admin-dashboard__manage"
                to="/admin/feedback"
              >
                Customer Feedback
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                className="customer-button customer-button-outline admin-dashboard__manage"
                to="/admin/reports"
              >
                Reports
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                className="customer-button customer-button-outline admin-dashboard__manage"
                to="/admin/services"
              >
                Manage Services
              </Link>
            )}
            <button
              className="customer-button customer-button-outline admin-dashboard__logout"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </header>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        <section className="admin-dashboard__today-layout">
          <section
            className="customer-panel admin-dashboard__panel admin-dashboard__today-panel"
            aria-labelledby="admin-dashboard-today-heading"
          >
            <div className="customer-panel-header admin-dashboard__panel-header">
              <div>
                <h2 id="admin-dashboard-today-heading">Today’s appointments</h2>
                <p className="admin-dashboard__today-date">{todayLabel}</p>
              </div>
              <Link className="admin-dashboard__text-link" to="/admin/schedule">
                Open schedule
              </Link>
            </div>

            <div className="admin-dashboard__filters">
              <label className="admin-dashboard__search">
                <span className="admin-dashboard__visually-hidden">
                  Search today’s appointments
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer or service"
                />
              </label>
              <label className="admin-dashboard__status-filter">
                <span className="admin-dashboard__visually-hidden">
                  Filter appointments by status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            {loading ? (
              <p role="status">Loading today’s appointments…</p>
            ) : appointments.length === 0 ? (
              <p className="customer-empty-state">
                No appointments scheduled for today.
              </p>
            ) : visibleAppointments.length === 0 ? (
              <p className="customer-empty-state">
                No appointments match these filters.
              </p>
            ) : (
              <div className="admin-dashboard__list">
                {visibleAppointments.map((appointment) => (
                  <article
                    key={appointment._id}
                    className="admin-dashboard__appointment"
                  >
                    <div className="admin-dashboard__appointment-time">
                      <strong>{formatTime(appointment.startTime)}</strong>
                      <span>{formatTime(appointment.endTime)}</span>
                    </div>
                    <div className="admin-dashboard__appointment-details">
                      <strong>
                        {appointment.serviceName || "Salon service"}
                      </strong>
                      <span>{appointment.customerName || "Customer"}</span>
                      {appointment.staffName && (
                        <span>With {appointment.staffName}</span>
                      )}
                    </div>
                    <StatusBadge status={appointment.status} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside
            className="admin-dashboard__today-summary"
            aria-label="Today at a glance"
          >
            <article className="admin-dashboard__today-metric admin-dashboard__today-metric--featured">
              <span>Appointments today</span>
              <strong>{loading ? "—" : appointments.length}</strong>
              <p>Bookings on the salon calendar</p>
            </article>
            <article className="admin-dashboard__today-metric">
              <span>Customers today</span>
              <strong>{loading ? "—" : customerCount}</strong>
              <p>Distinct customers with a booking</p>
            </article>
            <article className="admin-dashboard__today-metric">
              <span>Services today</span>
              <strong>{loading ? "—" : serviceCount}</strong>
              <p>Different services booked</p>
            </article>
            <Link
              className="admin-dashboard__schedule-link"
              to="/admin/schedule"
            >
              Review appointments and schedule
            </Link>
          </aside>
        </section>

        <section
          className="admin-dashboard__stats"
          aria-label="Appointment summary"
        >
          <article className="admin-dashboard__stat admin-dashboard__stat--pending">
            <p>Pending</p>
            <strong>{statusCounts.pending ?? 0}</strong>
            <span>Awaiting confirmation</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--confirmed">
            <p>Confirmed</p>
            <strong>{statusCounts.confirmed ?? 0}</strong>
            <span>Ready for the salon</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--completed">
            <p>Completed</p>
            <strong>{statusCounts.completed ?? 0}</strong>
            <span>Appointments already served</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--cancelled">
            <p>Cancelled</p>
            <strong>{statusCounts.cancelled ?? 0}</strong>
            <span>Appointments no longer scheduled</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--total">
            <p>Total appointments</p>
            <strong>
              {statusCounts.pending !== undefined
                ? totalCount
                : appointments.length}
            </strong>
            <span>Across all appointment statuses</span>
          </article>
        </section>
      </main>
    </div>
  );
}

export default AdminDashboardPage;
