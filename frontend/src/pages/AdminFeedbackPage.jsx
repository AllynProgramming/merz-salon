import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import StarRating from "../components/customer/StarRating.jsx";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";

function formatAppointmentDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
}

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = String(value).split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatSubmittedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}

function customerName(customer) {
  return (
    customer?.name ||
    [customer?.firstname, customer?.lastname].filter(Boolean).join(" ") ||
    "Customer"
  );
}

function AdminFeedbackPage() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    averageRating: null,
    ratingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFeedback() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/feedback/admin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Could not load customer feedback.");
        }
        if (active) {
          setItems(payload.items || []);
          setSummary(payload.summary || { averageRating: null, ratingCount: 0 });
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Could not load customer feedback.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFeedback();
    return () => {
      active = false;
    };
  }, [token]);

  const hasRatings = summary.ratingCount > 0;

  return (
    <div className="customer-page salon-landing admin-feedback-page">
      <Helmet>
        <title>Customer Feedback | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-dashboard__heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Customer Feedback</h1>
            <p className="customer-lede">
              Read customer reviews and see their ratings for completed services.
            </p>
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
          className="customer-panel admin-feedback__summary"
          aria-label="Overall customer rating"
        >
          <div>
            <p className="customer-eyebrow">Overall customer rating</p>
            {hasRatings ? (
              <div className="admin-feedback__average">
                <strong>{summary.averageRating.toFixed(1)}</strong>
                <StarRating value={summary.averageRating} />
              </div>
            ) : (
              <strong className="admin-feedback__no-rating">
                {loading ? "Loading ratings..." : "No ratings yet"}
              </strong>
            )}
          </div>
          <span>
            {summary.ratingCount} {summary.ratingCount === 1 ? "review" : "reviews"}
          </span>
        </section>

        <section className="customer-panel admin-dashboard__panel admin-feedback__panel">
          <div className="customer-panel-header admin-dashboard__panel-header">
            <h2>Submitted feedback</h2>
            <span>{summary.ratingCount} total</span>
          </div>

          {loading ? (
            <p role="status">Loading customer feedback...</p>
          ) : items.length === 0 ? (
            <p className="customer-empty-state">
              No customer feedback has been submitted yet.
            </p>
          ) : (
            <div className="admin-feedback__list">
              {items.map((item) => {
                const appointmentDate = formatAppointmentDate(
                  item.appointment?.date,
                );
                const appointmentTime = formatTime(item.appointment?.startTime);
                const appointmentDetails = [appointmentDate, appointmentTime]
                  .filter(Boolean)
                  .join(" at ");

                return (
                  <article className="admin-feedback__item" key={item._id}>
                    <div className="admin-feedback__identity">
                      <strong>{customerName(item.customer)}</strong>
                      <span>
                        {item.service?.name || "Salon service"}
                        {appointmentDetails ? ` · ${appointmentDetails}` : ""}
                      </span>
                    </div>
                    <div className="admin-feedback__rating">
                      <StarRating value={item.rating} />
                      <span>{item.rating} / 5</span>
                    </div>
                    {item.comment && (
                      <p className="admin-feedback__comment">{item.comment}</p>
                    )}
                    <time
                      className="admin-feedback__submitted"
                      dateTime={item.createdAt}
                    >
                      {formatSubmittedAt(item.createdAt)}
                    </time>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminFeedbackPage;