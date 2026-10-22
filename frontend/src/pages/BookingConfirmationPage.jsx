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

const appointmentStatusCopy = {
  pending: {
    eyebrow: "Appointment request received",
    title: "Your appointment is pending",
    description:
      "Your request is waiting for staff confirmation. Keep this reference handy and contact the salon if you’re running late.",
  },
  confirmed: {
    eyebrow: "Booking confirmed",
    title: "Your appointment is confirmed",
    description:
      "Your booking is confirmed. Keep this reference handy and review your appointment details below.",
  },
  completed: {
    eyebrow: "Appointment complete",
    title: "Your appointment is completed",
    description: "Review your appointment details below.",
  },
  cancelled: {
    eyebrow: "Appointment update",
    title: "Your appointment is cancelled",
    description: "Review your appointment details below for the latest update.",
  },
  expired: {
    eyebrow: "Appointment update",
    title: "Your appointment has expired",
    description: "Review your appointment details below for the latest update.",
  },
};

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
    let active = true;

    const refreshAppointment = async () => {
      try {
        const result = await getAppointment(id, token);
        if (active) {
          setAppointment(result.appointment || result);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.message || "We couldn't load this confirmation.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    refreshAppointment();
    return () => {
      active = false;
    };
  }, [id, token]);

  useEffect(() => {
    if (appointment?.status !== "pending") return undefined;

    let active = true;
    const intervalId = window.setInterval(async () => {
      try {
        const result = await getAppointment(id, token);
        if (active) {
          setAppointment(result.appointment || result);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.message || "We couldn't refresh your appointment.",
          );
        }
      }
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [appointment?.status, id, token]);

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
  const statusCopy =
    appointmentStatusCopy[appointment?.status] || {
      eyebrow: "Appointment update",
      title: "Your appointment details",
      description: "Review your appointment details below for the latest update.",
    };

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
        ) : error && !appointment ? (
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
              {error && (
                <div className="booking-form-error" role="status">
                  {error} Your saved booking details are still shown below.
                </div>
              )}
              <span className="booking-confirmation-mark" aria-hidden="true">
                ✓
              </span>
              <p className="booking-eyebrow">{statusCopy.eyebrow}</p>
              <h1 id="confirmation-title">{statusCopy.title}</h1>
              <p className="booking-lede">{statusCopy.description}</p>
              <BookingSummary
                service={service}
                date={appointment.date}
                startTime={appointment.startTime}
                endTime={appointment.endTime}
                status={appointment.status}
              />
              {appointment.staffName && (
                <p className="booking-assigned-staff">
                  Staff: <strong>{appointment.staffName}</strong>
                </p>
              )}
              <p className="booking-reference">
                Booking reference:{" "}
                <strong>
                  {appointment.bookingReference || appointment._id}
                </strong>
              </p>
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
