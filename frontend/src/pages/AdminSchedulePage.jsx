import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import useAuth from "../context/useAuth.js";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import "../styles/customer.css";

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

function AdminSchedulePage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadAppointments = async () => {
    try {
      const response = await fetch("/api/staff/appointments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Could not load the schedule.");
      }
      setAppointments(payload.items || payload.appointments || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load the schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        await loadAppointments();
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [token]);

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
      await loadAppointments();
    } catch (requestError) {
      setError(requestError.message || "Could not confirm this appointment.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="customer-page salon-landing">
      <Helmet>
        <title>Admin Schedule | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Schedule management</p>
            <h1>Admin Schedule</h1>
            <p className="customer-lede">
              Review pending requests and confirm the next salon bookings.
            </p>
          </div>
        </header>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        <section className="customer-panel">
          <div className="customer-panel-header">
            <h2>Schedule queue</h2>
          </div>

          {loading ? (
            <p role="status">Loading schedule…</p>
          ) : appointments.length === 0 ? (
            <p className="customer-empty-state">There are no appointments to manage right now.</p>
          ) : (
            <div className="customer-list customer-admin-list">
              {appointments.map((appointment) => (
                <div key={appointment._id} className="customer-list-item customer-admin-appointment">
                  <div>
                    <strong>{appointment.serviceName || "Salon service"}</strong>
                    <p>
                      {appointment.customerName || "Customer"} · {formatDate(appointment.date)} · {formatTime(appointment.startTime)}
                    </p>
                  </div>
                  <div className="customer-admin-actions">
                    <StatusBadge status={appointment.status} />
                    {appointment.status === "pending" && (
                      <button
                        type="button"
                        className="customer-button customer-button-primary"
                        onClick={() => confirmAppointment(appointment._id)}
                        disabled={busyId === appointment._id}
                      >
                        {busyId === appointment._id ? "Confirming…" : "Confirm"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminSchedulePage;
