import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import { StatusBadge } from "../components/booking/BookingComponents.jsx";
import { formatPrice } from "../components/booking/bookingUtils.js";
import StarRating from "../components/customer/StarRating.jsx";
import useAuth from "../context/useAuth.js";
import { cancelAppointment, getAppointments } from "../services/bookingApi.js";
import "../styles/customer.css";

const typeOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

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

function AppointmentsPage() {
  const { token } = useAuth();
  const [type, setType] = useState("upcoming");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pendingCancelId, setPendingCancelId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const items = data?.items || [];
  const counts = data?.counts || {};

  useEffect(() => {
    let active = true;

    const loadAppointments = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getAppointments({
          token,
          type,
          status,
          search,
          from,
          to,
          sort: sort || undefined,
          page,
          limit: 10,
        });
        if (active) setData(result);
      } catch (requestError) {
        if (active)
          setError(
            requestError.message || "We couldn't load your appointments.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAppointments();
    return () => {
      active = false;
    };
  }, [token, type, status, search, from, to, sort, page, retry]);

  const selectType = (nextType) => {
    setType(nextType);
    setPage(1);
  };

  const handleTabKeyDown = (event, currentIndex) => {
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % typeOptions.length
        : event.key === "ArrowLeft"
          ? (currentIndex + typeOptions.length - 1) % typeOptions.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? typeOptions.length - 1
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    selectType(typeOptions[nextIndex].value);
    event.currentTarget.parentElement.children[nextIndex]?.focus();
  };

  const handleCancel = async (appointment) => {
    if (
      !window.confirm(
        `Cancel your ${appointment.serviceName || "appointment"}?`,
      )
    )
      return;
    setPendingCancelId(appointment._id);
    setError("");
    try {
      await cancelAppointment(appointment._id, token);
      setRetry((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || "We couldn't cancel this appointment.");
    } finally {
      setPendingCancelId("");
    }
  };

  const emptyCopy = {
    upcoming: [
      "No upcoming appointments",
      "Your next salon visit will appear here once it is booked.",
    ],
    past: [
      "No past appointments",
      "Completed and cancelled visits will appear here.",
    ],
    all: [
      "No appointments yet",
      "Your appointments will appear here once you book.",
    ],
  }[type];

  return (
    <div className="customer-page salon-landing">
      <Helmet>
        <title>Appointments | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main className="customer-container">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Your salon history</p>
            <h1>My Appointments</h1>
            <p className="customer-lede">
              Review visits, check booking status, and manage your appointments.
            </p>
          </div>
          <Link
            className="customer-button customer-button-outline"
            to="/dashboard"
          >
            Dashboard
          </Link>
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
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}

        <section
          className="customer-panel customer-history-panel"
          aria-label="Appointment history"
        >
          <div
            className="customer-history-tabs"
            role="tablist"
            aria-label="Appointment time range"
          >
            {typeOptions.map((option, index) => (
              <button
                aria-controls="appointment-history-list"
                aria-selected={type === option.value}
                className={`customer-history-tab ${type === option.value ? "is-active" : ""}`}
                id={`appointment-tab-${option.value}`}
                key={option.value}
                onClick={() => selectType(option.value)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={type === option.value ? 0 : -1}
                type="button"
              >
                {option.label}
                <span>{counts[option.value] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="customer-history-filter-toggle">
            <button
              aria-controls="customer-history-filters"
              aria-expanded={filtersOpen}
              className="customer-button customer-button-outline"
              onClick={() => setFiltersOpen((open) => !open)}
              type="button"
            >
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
          </div>
          <div
            className={`customer-history-filters ${filtersOpen ? "is-open" : ""}`}
            id="customer-history-filters"
          >
            <label className="customer-history-search">
              <span>Search service or reference</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="customer-history-filter">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="customer-history-filter">
              <span>From</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="customer-history-filter">
              <span>To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="customer-history-filter">
              <span>Sort</span>
              <select
                value={sort || (type === "upcoming" ? "date_asc" : "date_desc")}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="date_asc">Soonest first</option>
                <option value="date_desc">Newest first</option>
              </select>
            </label>
          </div>

          <div
            id="appointment-history-list"
            role="tabpanel"
            aria-labelledby={`appointment-tab-${type}`}
          >
            {loading ? (
              <div
                className="customer-history-loading"
                role="status"
                aria-busy="true"
              >
                <span />
                <span />
                <span />
                <p>Loading appointments...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="customer-empty-state customer-history-empty">
                <h2>{emptyCopy[0]}</h2>
                <p>{emptyCopy[1]}</p>
                <Link
                  className="customer-button customer-button-primary"
                  to="/book-appointment"
                >
                  Book an appointment
                </Link>
              </div>
            ) : (
              <div className="customer-history-list">
                {items.map((appointment) => (
                  <article
                    className="customer-history-item"
                    key={appointment._id}
                  >
                    <div className="customer-history-main">
                      <div className="customer-history-service">
                        <h2>{appointment.serviceName || "Salon service"}</h2>
                        <p>
                          {formatDate(appointment.date)} at{" "}
                          {formatTime(appointment.startTime)}
                          {appointment.endTime
                            ? ` – ${formatTime(appointment.endTime)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <dl className="customer-history-meta">
                      <div>
                        <dt>Price</dt>
                        <dd>{formatPrice(appointment.price)}</dd>
                      </div>
                      <div>
                        <dt>Booking reference</dt>
                        <dd>
                          {appointment.bookingReference || appointment._id}
                        </dd>
                      </div>
                      {appointment.hasFeedback && (
                        <div>
                          <dt>Your rating</dt>
                          <dd>
                            <StarRating value={appointment.rating} />
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="customer-history-actions">
                      <Link
                        className="customer-button customer-button-outline"
                        to={`/appointments/${appointment._id}`}
                      >
                        View Details
                      </Link>
                      {appointment.canReschedule && (
                        <Link
                          className="customer-button customer-button-outline"
                          to={`/appointments/${appointment._id}/reschedule`}
                        >
                          Reschedule
                        </Link>
                      )}
                      {appointment.canCancel && (
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          disabled={pendingCancelId === appointment._id}
                          onClick={() => handleCancel(appointment)}
                        >
                          {pendingCancelId === appointment._id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      )}
                      {appointment.status === "completed" &&
                        !appointment.hasFeedback && (
                          <Link
                            className="customer-button customer-button-primary"
                            to={`/appointments/${appointment._id}`}
                          >
                            Leave Feedback
                          </Link>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {!loading && (data?.totalPages || 1) > 1 && (
            <nav
              className="customer-history-pagination"
              aria-label="Appointment pages"
            >
              <button
                className="customer-button customer-button-outline"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {page} of {data.totalPages}
              </span>
              <button
                className="customer-button customer-button-outline"
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}

export default AppointmentsPage;
