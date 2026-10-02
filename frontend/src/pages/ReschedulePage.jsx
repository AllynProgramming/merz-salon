import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import DatePicker from "../components/booking/DatePicker.jsx";
import {
  BookingSummary,
  TimeSlotGrid,
  Toast,
} from "../components/booking/BookingComponents.jsx";
import { formatDate, formatTime } from "../components/booking/bookingUtils.js";
import useAuth from "../context/useAuth.js";
import {
  getAppointment,
  getAvailability,
  rescheduleAppointment,
} from "../services/bookingApi.js";
import "../styles/booking.css";

function ReschedulePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [slotRetry, setSlotRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getAppointment(id, token)
      .then((result) => {
        if (!active) return;
        const item = result.appointment || result;
        setAppointment(item);
        setDate(item.date);
        setSlotsLoading(true);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.message || "We couldn't load this appointment.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  useEffect(() => {
    if (!appointment || !date) return undefined;
    let active = true;
    getAvailability({
      serviceId: appointment.service?._id || appointment.service,
      date,
      excludeAppointmentId: id,
      token,
    })
      .then((result) => {
        if (!active) return;
        setSlots(result.slots || []);
        setError("");
        setSlot((current) =>
          current &&
          result.slots?.some(
            (item) => item.startTime === current.startTime && item.available,
          )
            ? current
            : null,
        );
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "We couldn't load available times.");
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointment, date, id, token, slotRetry]);

  const chooseDate = (value) => {
    setDate(value);
    setSlot(null);
    setSlotsLoading(true);
    setError("");
  };

  const submit = async () => {
    if (!date || !slot?.available) return;
    setSaving(true);
    setError("");
    try {
      const result = await rescheduleAppointment(id, {
        date,
        startTime: slot.startTime,
        token,
      });
      const updated = result.appointment || result;
      setNotice("Your appointment has been rescheduled.");
      navigate(`/appointments/${id}`, {
        replace: true,
        state: {
          appointment: updated,
          notice: "Your appointment has been rescheduled.",
        },
      });
    } catch (requestError) {
      if (requestError.status === 409) {
        setSlot(null);
        setSlotsLoading(true);
        setSlotRetry((value) => value + 1);
        setError("That time was just taken. Please choose another slot.");
      } else {
        setError(
          requestError.message || "We couldn't reschedule this appointment.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const service = appointment
    ? {
        name:
          appointment.serviceName ||
          appointment.service?.name ||
          "Salon service",
        price: appointment.servicePrice,
        durationMinutes: appointment.durationMinutes,
      }
    : null;

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Reschedule Appointment | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Appointment changes</p>
            <h1>Reschedule</h1>
            <p className="booking-lede">
              Choose a new date and available time for your existing service.
            </p>
          </div>
          <Link
            className="booking-button booking-button-outline"
            to={`/appointments/${id}`}
          >
            Back to details
          </Link>
        </header>
        {notice && <Toast message={notice} />}
        {error && (
          <div
            className="booking-form-error"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}
        {loading ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading appointment...
          </div>
        ) : appointment && !appointment.canReschedule ? (
          <div className="booking-state">
            <h2>Rescheduling is unavailable</h2>
            <p>
              {appointment.cancelReason ||
                "This appointment can no longer be changed."}
            </p>
            <Link
              className="booking-button booking-button-outline"
              to={`/appointments/${id}`}
            >
              Return to appointment
            </Link>
          </div>
        ) : (
          appointment && (
            <div className="booking-step-layout">
              <section className="booking-panel">
                <h2>Choose a new time</h2>
                <p className="booking-panel-intro">{service?.name}</p>
                <div className="booking-comparison">
                  <div>
                    <strong>Current appointment</strong>
                    <span>
                      {formatDate(appointment.date)} ·{" "}
                      {formatTime(appointment.startTime)}
                    </span>
                  </div>
                  <div>
                    <strong>New appointment</strong>
                    <span>
                      {date && slot
                        ? `${formatDate(date)} · ${formatTime(slot.startTime)}`
                        : "Choose a date and time"}
                    </span>
                  </div>
                </div>
                <DatePicker
                  value={date}
                  onChange={chooseDate}
                  serviceDuration={
                    appointment.durationMinutes ||
                    service?.durationMinutes ||
                    30
                  }
                />
                <div className="booking-slot-section">
                  <h3>Available times</h3>
                  <TimeSlotGrid
                    slots={slots}
                    selectedTime={slot?.startTime}
                    onSelect={setSlot}
                    loading={slotsLoading}
                    error={error && !error.includes("taken") ? error : ""}
                    onRetry={() => {
                      setError("");
                      setSlotsLoading(true);
                      setSlotRetry((value) => value + 1);
                    }}
                  />
                </div>
                <div className="booking-action-row">
                  <Link
                    className="booking-button booking-button-outline"
                    to={`/appointments/${id}`}
                  >
                    Back
                  </Link>
                  <button
                    className="booking-button booking-button-primary"
                    type="button"
                    onClick={submit}
                    disabled={!slot?.available || saving}
                  >
                    {saving && (
                      <span className="booking-spinner" aria-hidden="true" />
                    )}
                    {saving ? "Rescheduling..." : "Confirm New Time"}
                  </button>
                </div>
              </section>
              <aside className="booking-summary-panel">
                <h2>Service details</h2>
                <BookingSummary
                  service={service}
                  date={appointment.date}
                  startTime={appointment.startTime}
                  endTime={appointment.endTime}
                  status={appointment.status}
                />
              </aside>
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default ReschedulePage;
