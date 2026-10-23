import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  formatDuration,
  formatPrice,
} from "../components/booking/bookingUtils.js";
import { getServices } from "../services/bookingApi.js";
import "../styles/booking.css";
import "../styles/admin-dashboard.css";
import "../styles/staff-services.css";

function StaffServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    getServices()
      .then((result) => {
        if (active) setServices(result);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Could not load salon services.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retry]);

  return (
    <div className="booking-page salon-landing staff-services-page">
      <Helmet>
        <title>Available Services | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="booking-container">
        <header className="booking-header staff-services__header admin-section-heading">
          <div>
            <p className="booking-eyebrow">Salon operations</p>
            <h1>Available Services</h1>
            <p className="booking-lede">
              Review current salon services, descriptions, prices, and estimated
              durations.
            </p>
          </div>
          <div className="staff-services__header-actions">
            <Link
              className="customer-button customer-button-primary"
              to="/staff/book-appointment"
            >
              Book for Customer
            </Link>
            <Link
              className="customer-button customer-button-outline"
              to="/staff"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading available services…
          </div>
        ) : error ? (
          <div className="booking-state booking-state-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setRetry((current) => current + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="booking-state">
            <h2>No available services</h2>
            <p>Active salon services will appear here.</p>
          </div>
        ) : (
          <div className="booking-service-grid staff-services__grid">
            {services.map((service) => (
              <article className="booking-service-card" key={service._id}>
                <div className="booking-service-topline">
                  <span className="booking-category-label">
                    {service.category || "Salon service"}
                  </span>
                  <span className="booking-duration">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </div>
                <h3>{service.name}</h3>
                <p className="booking-service-description">
                  {service.description || "No description provided."}
                </p>
                <div className="booking-service-footer">
                  <strong>{formatPrice(service.price)}</strong>
                  <span className="staff-services__duration-label">
                    Estimated duration
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default StaffServicesPage;
