import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import { getStaffAppointment } from "../services/bookingApi.js";
import "../styles/booking.css";
import "../styles/admin-dashboard.css";
import "../styles/staff-services.css";
import "../styles/staff-booking.css";

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(
    new Date(year, month - 1, day),
  );
}

function StaffBookingSuccessPage() {
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [appointment, setAppointment] = useState(
    location.state?.appointment || null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getStaffAppointment(id, token)
      .then((result) => {
        if (active) {
          setAppointment(result.appointment || result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.message || "Could not load the booking confirmation.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, token]);

  const customerName =
    appointment?.customerName || "Walk-in or registered customer";
  const serviceName =
    appointment?.serviceName || appointment?.service?.name || "Salon service";

  return (
    <div className="booking-page salon-landing staff-booking-page">
      <Helmet>
        <title>Booking Confirmed | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="booking-container staff-booking">
        <header className="booking-header staff-services__header admin-section-heading">
          <div>
            <p className="booking-eyebrow">Salon operations</p>
            <h1>Booking confirmation</h1>
            <p className="booking-lede">
              Review the appointment details below.
            </p>
          </div>
          <Link className="customer-button customer-button-outline" to="/staff">
            Back to dashboard
          </Link>
        </header>

        {loading && !appointment ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading booking confirmation…
          </div>
        ) : error && !appointment ? (
          <div className="booking-state booking-state-error" role="alert">
            <p>{error}</p>
            <Link to="/admin/schedule">Go to salon schedule</Link>
          </div>
        ) : (
          appointment && (
            <section className="staff-booking__success" role="status">
              <div className="staff-booking__success-heading">
                <svg
                  className="staff-booking__success-icon"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="10" cy="10" r="8.25" />
                  <path d="m6.5 10 2.25 2.25 4.75-5" />
                </svg>
                <strong>Appointment confirmed</strong>
              </div>
              <p>
                The appointment is confirmed and scheduled in the salon
                calendar.
              </p>
              {error && (
                <p role="alert">
                  {error} The booking details shown here are from the completed
                  booking.
                </p>
              )}
              <dl className="staff-booking__confirmation-details">
                <div>
                  <dt>Customer</dt>
                  <dd>
                    {customerName}
                    {appointment.isWalkIn && (
                      <span className="staff-booking__walkin-badge">
                        Walk-in
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{serviceName}</dd>
                </div>
                <div>
                  <dt>Date and time</dt>
                  <dd>
                    {formatDate(appointment.date)} ·{" "}
                    {formatTime(appointment.startTime)}
                    {appointment.endTime &&
                      `–${formatTime(appointment.endTime)}`}
                  </dd>
                </div>
                {appointment.staffName && (
                  <div>
                    <dt>Staff</dt>
                    <dd>{appointment.staffName}</dd>
                  </div>
                )}
                <div>
                  <dt>Booking reference</dt>
                  <dd>
                    {appointment.bookingReference || appointment._id}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{appointment.status || "Confirmed"}</dd>
                </div>
              </dl>
              <div className="staff-booking__confirmation-actions">
                <Link
                  className="customer-button customer-button-primary"
                  to="/staff/book-appointment"
                >
                  Book another appointment
                </Link>
                <Link
                  className="customer-button customer-button-outline"
                  to="/admin/schedule"
                >
                  View salon schedule
                </Link>
              </div>
            </section>
          )
        )}
      </main>
    </div>
  );
}

export default StaffBookingSuccessPage;
