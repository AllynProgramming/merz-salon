import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import {
  BookingSummary,
  Stepper,
} from "../components/booking/BookingComponents.jsx";
import useAuth from "../context/useAuth.js";
import { getAppointment } from "../services/bookingApi.js";
import "../styles/booking.css";

function BookingConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [appointment, setAppointment] = useState(
    location.state?.appointment || null,
  );
  const [loading, setLoading] = useState(!location.state?.appointment);
  const [error, setError] = useState("");

  useEffect(() => {
    if (appointment) return undefined;
    let active = true;
    getAppointment(id, token)
      .then((result) => {
        if (active) setAppointment(result.appointment || result);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.message || "We couldn't load this confirmation.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointment, id, token]);

  const service = appointment
    ? {
        name:
          appointment.serviceName ||
          appointment.service?.name ||
          "Salon service",
        price: appointment.servicePrice ?? appointment.service?.price,
        durationMinutes:
          appointment.durationMinutes ?? appointment.service?.durationMinutes,
      }
    : null;

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Booking Confirmation | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main className="booking-container">
        <Stepper
          steps={["Service", "Date", "Time", "Review", "Confirmation"]}
          currentStep={4}
        />
        {loading ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading your confirmation...
          </div>
        ) : error ? (
          <div className="booking-state booking-state-error" role="alert">
            <span>{error}</span>
            <Link to="/dashboard">Go to Dashboard</Link>
          </div>
        ) : (
          appointment && (
            <section
              className="booking-confirmation"
              aria-labelledby="confirmation-title"
            >
              <span className="booking-confirmation-mark" aria-hidden="true">
                ✓
              </span>
              <p className="booking-eyebrow">Appointment request received</p>
              <h1 id="confirmation-title">Your appointment is pending</h1>
              <p className="booking-lede">
                Keep this reference handy. Your request stays pending while
                staff confirms it. If you’re running late, contact the salon.
              </p>
              <BookingSummary
                service={service}
                date={appointment.date}
                startTime={appointment.startTime}
                endTime={appointment.endTime}
                status={appointment.status}
              />
              <div className="booking-confirmation-actions">
                <Link
                  className="booking-button booking-button-primary"
                  to={`/appointments/${id}`}
                >
                  View Appointment
                </Link>
                <Link
                  className="booking-button booking-button-outline"
                  to="/dashboard"
                >
                  Go to Dashboard
                </Link>
                <Link className="booking-text-link" to="/book-appointment">
                  Book Another
                </Link>
              </div>
            </section>
          )
        )}
      </main>
    </div>
  );
}

export default BookingConfirmationPage;
