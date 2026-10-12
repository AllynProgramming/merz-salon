import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import useAuth from "../context/useAuth.js";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";

function formatDate(value) {
  if (!value) return "Date to be confirmed";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
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

function AdminDashboardPage() {
  const { user, token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/staff/appointments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Could not load appointments.");
        }
        if (active) setAppointments(payload.items || payload.appointments || []);
      } catch (requestError) {
        if (active) setError(requestError.message || "Could not load appointments.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) loadAppointments();
    return () => {
      active = false;
    };
  }, [token]);

  const pendingCount = appointments.filter((item) => item.status === "pending").length;
  const confirmedCount = appointments.filter((item) => item.status === "confirmed").length;

  return (
    <div className="customer-page salon-landing admin-dashboard-page">
      <Helmet>
        <title>Admin Dashboard | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-dashboard__heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Admin Dashboard</h1>
            <p className="customer-lede">
              Welcome back, {user?.name || user?.firstname || "Team member"}.
              Here’s the latest appointment overview.
            </p>
          </div>
          <Link
            className="customer-button customer-button-outline admin-dashboard__manage"
            to="/admin/schedule"
          >
            Manage Schedule
          </Link>
        </header>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        <section
          className="admin-dashboard__stats"
          aria-label="Appointment summary"
        >
          <article className="admin-dashboard__stat admin-dashboard__stat--pending">
            <p>Pending</p>
            <strong>{pendingCount}</strong>
            <span>Awaiting confirmation</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--confirmed">
            <p>Confirmed</p>
            <strong>{confirmedCount}</strong>
            <span>Ready for the salon</span>
          </article>
          <article className="admin-dashboard__stat admin-dashboard__stat--total">
            <p>Total appointments</p>
            <strong>{appointments.length}</strong>
            <span>Across the current schedule</span>
          </article>
        </section>

        <section className="customer-panel admin-dashboard__panel">
          <div className="customer-panel-header admin-dashboard__panel-header">
            <h2>Recent appointments</h2>
            <span>{appointments.length} in schedule</span>
          </div>

          {loading ? (
            <p role="status">Loading appointment list…</p>
          ) : appointments.length === 0 ? (
            <p className="customer-empty-state">
              No appointments yet. New bookings will appear here.
            </p>
          ) : (
            <div className="admin-dashboard__list">
              {appointments.slice(0, 6).map((appointment) => (
                <article
                  key={appointment._id}
                  className="admin-dashboard__appointment"
                >
                  <div className="admin-dashboard__appointment-time">
                    <strong>{formatTime(appointment.startTime)}</strong>
                    <span>{formatDate(appointment.date)}</span>
                  </div>
                  <div className="admin-dashboard__appointment-details">
                    <strong>{appointment.serviceName || "Salon service"}</strong>
                    <span>{appointment.customerName || "Customer"}</span>
                  </div>
                  <StatusBadge status={appointment.status} />
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboardPage;
