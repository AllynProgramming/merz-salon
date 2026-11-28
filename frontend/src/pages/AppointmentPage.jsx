import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import StarRating from "../components/customer/StarRating.jsx";
import {
  BookingSummary,
  StatusBadge,
} from "../components/booking/BookingComponents.jsx";
import RescheduleModal from "../components/customer/RescheduleModal.jsx";
import FeedbackModal from "../components/customer/FeedbackModal.jsx";
import useConfirm from "../components/ui/useConfirm.jsx";
import { toast } from "../components/ui/toast.js";
import { formatDate, formatTime } from "../components/booking/bookingUtils.js";
import useAuth from "../context/useAuth.js";
import { cancelAppointment, getAppointment } from "../services/bookingApi.js";
import "../styles/booking.css";

function AppointmentPage() {
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  // Older links to /appointments/:id/reschedule land here with the
  // reschedule modal already open.
  const [rescheduleOpen, setRescheduleOpen] = useState(
    Boolean(location.state?.openReschedule),
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  // A message handed over by the page that sent us here.
  useEffect(() => {
    if (location.state?.notice) toast.success(location.state.notice);
  }, [location.state?.notice]);

  useEffect(() => {
    let active = true;

    const loadAppointment = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await getAppointment(id, token);
        if (active) setAppointment(result);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.message || "We couldn't load this appointment.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAppointment();
    return () => {
      active = false;
    };
  }, [id, token, retry]);

  const cancel = async () => {
    if (cancelLoading) return;
    const confirmed = await confirm({
      title: "Cancel this appointment?",
      description: `This can't be undone. You're cancelling ${serviceName} on ${formatDate(appointment.date)} at ${formatTime(appointment.startTime)}.`,
      confirmLabel: "Cancel Appointment",
      cancelLabel: "Keep Appointment",
      tone: "danger",
    });
    if (!confirmed) return;
    setCancelLoading(true);
    try {
      const result = await cancelAppointment(id, token);
      setAppointment(result.appointment || result);
      toast.success("Your appointment was cancelled.");
    } catch (requestError) {
      toast.error(requestError.message || "We couldn't cancel this appointment.");
    } finally {
      setCancelLoading(false);
    }
  };

  const serviceName =
    appointment?.serviceName || appointment?.service?.name || "Salon service";
  const appointmentService = appointment
    ? {
        name: serviceName,
        price:
          appointment.servicePrice !== undefined
            ? appointment.servicePrice
            : appointment.service?.price,
        durationMinutes:
          appointment.durationMinutes ?? appointment.service?.durationMinutes,
      }
    : null;
  const activeHistoryIndex = (appointment?.statusHistory || []).reduce(
    (currentIndex, entry, index) =>
      entry.status === appointment?.status ? index : currentIndex,
    -1,
  );

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Appointment Details | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Your appointment</p>
            <h1>Appointment Details</h1>
            <p className="booking-lede">
              Review your salon visit and manage changes while they are
              available.
            </p>
          </div>
          <Link
            className="booking-button booking-button-outline"
            to="/dashboard"
          >
            Dashboard
          </Link>
        </header>
        {error && (
          <div className="booking-state booking-state-error" role="alert">
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
          <div className="booking-state" role="status" aria-busy="true">
            Loading appointment…
          </div>
        ) : (
          appointment && (
            <>
              <section
                className="booking-appointment-card"
                aria-labelledby="appointment-title"
              >
                <div className="booking-appointment-header">
                  <div>
                    <p className="booking-eyebrow">Booking reference</p>
                    <h2 id="appointment-title">{serviceName}</h2>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
                <BookingSummary
                  service={appointmentService}
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
                  Reference: {appointment.bookingReference || appointment._id}
                </p>
                <div className="booking-appointment-actions">
                  {appointment.canReschedule ? (
                    <button
                      className="booking-button booking-button-primary"
                      type="button"
                      onClick={() => setRescheduleOpen(true)}
                    >
                      Reschedule
                    </button>
                  ) : (
                    <div className="booking-disabled-action">
                      <button
                        className="booking-button booking-button-outline"
                        type="button"
                        disabled
                      >
                        Reschedule
                      </button>
                      <small>
                        {appointment.canRescheduleReason ||
                          "This appointment can no longer be changed."}
                      </small>
                    </div>
                  )}
                  {appointment.canCancel ? (
                    <button
                      className="booking-button booking-button-danger"
                      type="button"
                      onClick={cancel}
                      aria-busy={cancelLoading || undefined}
                    >
                      {cancelLoading ? "Cancelling…" : "Cancel Appointment"}
                    </button>
                  ) : (
                    <div className="booking-disabled-action">
                      <button
                        className="booking-button booking-button-outline"
                        type="button"
                        disabled
                      >
                        Cancel Appointment
                      </button>
                      <small>
                        {appointment.canCancelReason ||
                          "This appointment can no longer be cancelled."}
                      </small>
                    </div>
                  )}
                </div>
              </section>
              {appointment.statusHistory?.length > 0 && (
                <section
                  className="customer-panel"
                  aria-labelledby="status-history-title"
                >
                  <div className="customer-panel-header">
                    <h2 id="status-history-title">Booking updates</h2>
                  </div>
                  <ol className="customer-status-timeline">
                    {appointment.statusHistory.map((entry, index) => (
                      <li
                        aria-current={
                          index === activeHistoryIndex ? "step" : undefined
                        }
                        className={
                          index === activeHistoryIndex ? "is-current" : ""
                        }
                        key={`${entry.status}-${entry.changedAt || entry._id}`}
                      >
                        <div>
                          <StatusBadge status={entry.status} />
                        </div>
                        <div>
                          <strong>
                            {entry.note || "Appointment status updated"}
                          </strong>
                          <p>
                            {entry.changedAt
                              ? new Intl.DateTimeFormat(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(entry.changedAt))
                              : "Status updated"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {appointment.status === "completed" && (
                <section
                  className="customer-panel"
                  aria-labelledby="feedback-title"
                >
                  <div className="customer-panel-header">
                    <h2 id="feedback-title">Customer feedback</h2>
                  </div>
                  {appointment.feedback ? (
                    <div className="customer-feedback-box">
                      <StarRating value={appointment.feedback.rating} />
                      <p>
                        {appointment.feedback.comment ||
                          "You rated this visit without a written note."}
                      </p>
                      {appointment.canEditFeedback ? (
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          onClick={() => setFeedbackOpen(true)}
                        >
                          Edit Feedback
                        </button>
                      ) : (
                        <small>{appointment.canEditFeedbackReason}</small>
                      )}
                    </div>
                  ) : (
                    <div className="customer-feedback-box">
                      <p>
                        How was your visit? A quick rating helps other
                        customers and helps the salon improve.
                      </p>
                      <button
                        className="customer-button customer-button-primary"
                        type="button"
                        onClick={() => setFeedbackOpen(true)}
                      >
                        Leave Feedback
                      </button>
                    </div>
                  )}
                </section>
              )}

              <p className="booking-inline-back">
                <Link to="/dashboard">Return to dashboard</Link>
              </p>
            </>
          )
        )}
      </main>
      {rescheduleOpen && appointment?.canReschedule && (
        <RescheduleModal
          appointment={appointment}
          token={token}
          onClose={() => setRescheduleOpen(false)}
          onRescheduled={(updated) => {
            setRescheduleOpen(false);
            setAppointment((current) => ({ ...current, ...updated }));
            setRetry((value) => value + 1);
            toast.success("Your appointment has been moved to the new time.");
          }}
        />
      )}
      {feedbackOpen && appointment && (
        <FeedbackModal
          appointment={appointment}
          feedback={appointment.feedback}
          token={token}
          onClose={() => setFeedbackOpen(false)}
          onSaved={(feedback, kind) => {
            setFeedbackOpen(false);
            setAppointment((current) => ({
              ...current,
              feedback,
              canReview: false,
              canEditFeedback: true,
            }));
            toast.success(
              kind === "updated"
                ? "Your feedback was updated."
                : "Thank you! Your feedback was sent.",
            );
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

export default AppointmentPage;
