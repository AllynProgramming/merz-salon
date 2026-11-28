import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import RescheduleModal from "../components/customer/RescheduleModal.jsx";
import useConfirm from "../components/ui/useConfirm.jsx";
import { toast } from "../components/ui/toast.js";
import useAuth from "../context/useAuth.js";
import {
  cancelAppointment,
  getDashboardOverview,
} from "../services/bookingApi.js";
import "../styles/customer.css";

const statuses = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
];

function DashboardIcon({ name }) {
  const paths = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    pending: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    confirmed: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    completed: (
      <>
        <path d="M4 12.5 9 17l11-11" />
      </>
    ),
    cancelled: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
      </>
    ),
    expired: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5m0 3h.01" />
      </>
    ),
  };
  return (
    <svg
      className="customer-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

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

function EmptyAppointments({ hasHistory = false }) {
  return (
    <div className="customer-empty-state">
      <svg
        className="customer-empty-illustration"
        viewBox="0 0 160 128"
        fill="none"
        role="img"
        aria-label="An empty appointment book"
      >
        <rect
          x="27"
          y="22"
          width="105"
          height="88"
          rx="8"
          fill="#fff"
          stroke="#205638"
          strokeWidth="2"
        />
        <path
          d="M27 43h105M51 15v16m57-16v16"
          stroke="#205638"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M49 62h17m28 0h17M49 82h17m28 0h17"
          stroke="#7ca36f"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle
          cx="80"
          cy="71"
          r="17"
          fill="#f6ecc8"
          stroke="#d1ad3b"
          strokeWidth="2"
        />
        <path
          d="M80 62v10l6 4"
          stroke="#205638"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <h2>{hasHistory ? "No upcoming appointments" : "No appointments yet"}</h2>
      <p>
        {hasHistory
          ? "Your past appointments remain in your history."
          : "Your next salon visit will appear here once it is booked."}
      </p>
      <Link
        className="customer-button customer-button-primary"
        to="/book-appointment"
      >
        {hasHistory ? "Book an Appointment" : "Book your first appointment"}
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="customer-dashboard-skeleton"
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      <div className="customer-skeleton customer-skeleton-heading" />
      <div className="customer-skeleton-grid">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            className="customer-skeleton customer-skeleton-stat"
            key={item}
          />
        ))}
      </div>
      <div className="customer-skeleton customer-skeleton-feature" />
      <div className="customer-skeleton customer-skeleton-list" />
    </div>
  );
}

function DashboardPage() {
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  // The appointment open in the reschedule modal, or null.
  const [rescheduling, setRescheduling] = useState(null);
  const [cancellingId, setCancellingId] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const firstName =
    user?.name?.trim().split(/\s+/)[0] || user?.firstname || "there";

  useEffect(() => {
    let active = true;

    getDashboardOverview(token)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, retry]);

  const appointments = useMemo(
    () => data?.upcomingAppointments || [],
    [data?.upcomingAppointments],
  );
  const nextAppointment = data?.nextAppointment || appointments[0] || null;
  const counts = data?.counts || {};
  const statCards = [
    {
      label: "Upcoming",
      count: counts.upcoming ?? appointments.length,
      icon: "calendar",
    },
    ...statuses.map((status) => ({
      label: status,
      count: counts[status] || 0,
      icon: status,
    })),
  ];

  const finishReschedule = (updated) => {
    const id = String(rescheduling._id);
    setData((current) => {
      if (!current) return current;
      const updateAppointment = (appointment) =>
        String(appointment._id) === id
          ? { ...appointment, ...updated, service: appointment.service }
          : appointment;
      return {
        ...current,
        upcomingAppointments: current.upcomingAppointments.map(updateAppointment),
        nextAppointment: current.nextAppointment
          ? updateAppointment(current.nextAppointment)
          : current.nextAppointment,
      };
    });
    setRescheduling(null);
    toast.success("Your appointment has been moved to the new time.");
  };

  const cancelVisit = async (appointment) => {
    if (cancellingId) return;
    const confirmed = await confirm({
      title: "Cancel this appointment?",
      description: `This releases your ${formatDate(appointment.date)} at ${formatTime(appointment.startTime)} slot. You can book a new visit anytime.`,
      confirmLabel: "Cancel Appointment",
      cancelLabel: "Keep Appointment",
      tone: "danger",
    });
    if (!confirmed) return;

    const id = String(appointment._id);
    setCancellingId(id);
    try {
      await cancelAppointment(id, token);
      setData((current) => {
        if (!current) return current;
        const remaining = current.upcomingAppointments.filter(
          (item) => String(item._id) !== id,
        );
        return {
          ...current,
          upcomingAppointments: remaining,
          nextAppointment:
            String(current.nextAppointment?._id) === id
              ? remaining[0] || null
              : current.nextAppointment,
          counts: {
            ...current.counts,
            upcoming: Math.max(0, (current.counts?.upcoming || 0) - 1),
            cancelled: (current.counts?.cancelled || 0) + 1,
          },
        };
      });
      toast.success("Your appointment was cancelled.");
    } catch (requestError) {
      toast.error(requestError.message || "We couldn't cancel this appointment.");
    } finally {
      setCancellingId("");
    }
  };

  return (
    <div className="customer-page salon-landing">
      <Helmet>
        <title>Dashboard | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="customer-container customer-dashboard">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Your salon schedule</p>
            <h1>Welcome back, {firstName}</h1>
            <p className="customer-lede">
              Your appointments and account details, together in one place.
            </p>
          </div>
        </header>
        {error && (
          <div
            className="customer-alert customer-alert-error"
            role="alert"
            aria-live="assertive"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          !error && (
            <>
              <section
                className="customer-stat-grid"
                aria-label="Appointment summary"
              >
                {statCards.map((stat) => (
                  <article className="customer-stat-card" key={stat.label}>
                    <span className="customer-stat-icon">
                      <DashboardIcon name={stat.icon} />
                    </span>
                    <p>{stat.label}</p>
                    <strong className="ui-tabular">{stat.count}</strong>
                  </article>
                ))}
              </section>

              {appointments.length === 0 ? (
                <EmptyAppointments hasHistory={Boolean(counts.total)} />
              ) : (
                <>
                  {nextAppointment && (
                    <section
                      className="customer-next-card"
                      aria-labelledby="next-appointment-title"
                    >
                      <div className="customer-next-main">
                        <p className="customer-eyebrow">Next Appointment</p>
                        <h2 id="next-appointment-title">
                          {nextAppointment.service?.name || "Salon service"}
                        </h2>
                        <p className="customer-next-date">
                          {formatDate(nextAppointment.date)}{" "}
                          <span aria-hidden="true">/</span>{" "}
                          {formatTime(nextAppointment.startTime)}
                        </p>
                        <StatusBadge status={nextAppointment.status} />
                      </div>
                      <div className="customer-next-actions">
                        <Link
                          className="customer-button customer-button-outline"
                          to={`/appointments/${nextAppointment._id}`}
                        >
                          View Details
                        </Link>
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          onClick={() => setRescheduling(nextAppointment)}
                        >
                          Reschedule
                        </button>
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          onClick={() => cancelVisit(nextAppointment)}
                          aria-busy={
                            cancellingId === String(nextAppointment._id) ||
                            undefined
                          }
                        >
                          {cancellingId === String(nextAppointment._id)
                            ? "Cancelling…"
                            : "Cancel"}
                        </button>
                      </div>
                    </section>
                  )}

                  <section
                    className="customer-upcoming-section"
                    aria-labelledby="upcoming-title"
                  >
                    <div className="customer-section-title-row">
                      <h2 id="upcoming-title">Upcoming Appointments</h2>
                      <Link className="customer-inline-link" to="/appointments">
                        View All Appointments
                      </Link>
                    </div>
                    <div className="customer-appointment-list">
                      {appointments.map((appointment) => (
                        <article
                          className="customer-appointment-row"
                          key={appointment._id}
                        >
                          <div className="customer-appointment-date">
                            <strong>{formatDate(appointment.date)}</strong>
                            <span>{formatTime(appointment.startTime)}</span>
                          </div>
                          <div className="customer-appointment-service">
                            <h3>
                              {appointment.service?.name || "Salon service"}
                            </h3>
                            <span>
                              {appointment.endTime
                                ? `Ends ${formatTime(appointment.endTime)}`
                                : "Appointment"}
                            </span>
                          </div>
                          <StatusBadge status={appointment.status} />
                          <Link
                            className="customer-row-action"
                            to={`/appointments/${appointment._id}`}
                            aria-label={`View ${appointment.service?.name || "appointment"} details`}
                          >
                            View
                          </Link>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <section
                className="customer-quick-actions"
                aria-label="Quick actions"
              >
                <Link
                  className="customer-button customer-button-primary"
                  to="/book-appointment"
                >
                  Book an Appointment
                </Link>
                <Link
                  className="customer-button customer-button-outline"
                  to="/services"
                >
                  View Services
                </Link>
              </section>
            </>
          )
        )}
      </main>
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          token={token}
          onClose={() => setRescheduling(null)}
          onRescheduled={finishReschedule}
        />
      )}
      {confirmDialog}
    </div>
  );
}

export default DashboardPage;
