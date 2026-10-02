import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import StarRating from "../components/customer/StarRating.jsx";
import {
  BookingSummary,
  ConfirmDialog,
  StatusBadge,
  Toast,
} from "../components/booking/BookingComponents.jsx";
import { formatDate, formatTime } from "../components/booking/bookingUtils.js";
import useAuth from "../context/useAuth.js";
import {
  cancelAppointment,
  getAppointment,
  submitAppointmentFeedback,
  updateAppointmentFeedback,
} from "../services/bookingApi.js";
import "../styles/booking.css";

function AppointmentPage() {
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const cancelTrigger = useRef(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({
    rating: 0,
    comment: "",
  });
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState("");

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
    setCancelLoading(true);
    setError("");
    try {
      const result = await cancelAppointment(id, token);
      setAppointment(result.appointment || result);
      setNotice("Your appointment has been cancelled.");
      setConfirmCancel(false);
    } catch (requestError) {
      setError(requestError.message || "We couldn't cancel this appointment.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!feedbackDraft.rating) {
      setFeedbackError("Please choose a rating.");
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError("");
    setFeedbackSaved("");

    try {
      const result = editingFeedback
        ? await updateAppointmentFeedback({
            feedbackId: appointment.feedback._id,
            rating: feedbackDraft.rating,
            comment: feedbackDraft.comment,
            token,
          })
        : await submitAppointmentFeedback({
            appointmentId: id,
            rating: feedbackDraft.rating,
            comment: feedbackDraft.comment,
            token,
          });
      setAppointment((current) => ({
        ...current,
        feedback: result.feedback,
        canReview: false,
        canEditFeedback: true,
      }));
      setEditingFeedback(false);
      setFeedbackSaved(
        result.message ||
          (appointment.feedback
            ? "Your feedback was updated."
            : "Thank you for your feedback."),
      );
    } catch (requestError) {
      setFeedbackError(
        requestError.message || "We couldn't save your feedback.",
      );
    } finally {
      setFeedbackLoading(false);
    }
  };

  const serviceName =
    appointment?.serviceName || appointment?.service?.name || "Salon service";
  const appointmentService = appointment
    ? {
        name: serviceName,
        price: appointment.servicePrice ?? appointment.service?.price,
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
      <main className="booking-container">
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
        {notice && <Toast message={notice} onDismiss={() => setNotice("")} />}
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
            Loading appointment...
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
                <p className="booking-reference">
                  Reference: {appointment.bookingReference || appointment._id}
                </p>
                <div className="booking-appointment-actions">
                  {appointment.canReschedule ? (
                    <Link
                      className="booking-button booking-button-primary"
                      to={`/appointments/${id}/reschedule`}
                    >
                      Reschedule
                    </Link>
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
                      ref={cancelTrigger}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancel Appointment
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
                  {feedbackSaved && (
                    <div
                      className="customer-alert customer-alert-success"
                      role="status"
                      aria-live="polite"
                    >
                      {feedbackSaved}
                    </div>
                  )}
                  {appointment.feedback && !editingFeedback ? (
                    <div className="customer-feedback-box">
                      <StarRating value={appointment.feedback.rating} />
                      <p>
                        {appointment.feedback.comment ||
                          "You left this appointment without a written note."}
                      </p>
                      {appointment.canEditFeedback ? (
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          onClick={() => {
                            setFeedbackDraft({
                              rating: appointment.feedback.rating,
                              comment: appointment.feedback.comment || "",
                            });
                            setEditingFeedback(true);
                            setFeedbackError("");
                            setFeedbackSaved("");
                          }}
                        >
                          Edit feedback
                        </button>
                      ) : (
                        <small>{appointment.canEditFeedbackReason}</small>
                      )}
                    </div>
                  ) : (
                    <form
                      className="customer-feedback-form"
                      onSubmit={handleFeedbackSubmit}
                    >
                      <label>
                        <span>Your rating</span>
                        <StarRating
                          value={feedbackDraft.rating}
                          interactive
                          onChange={(rating) =>
                            setFeedbackDraft((current) => ({
                              ...current,
                              rating,
                            }))
                          }
                          disabled={feedbackLoading}
                        />
                      </label>
                      <label>
                        <span>Comments</span>
                        <textarea
                          value={feedbackDraft.comment}
                          rows={4}
                          maxLength={1000}
                          placeholder="Tell us about your salon experience"
                          onChange={(event) =>
                            setFeedbackDraft((current) => ({
                              ...current,
                              comment: event.target.value,
                            }))
                          }
                          disabled={feedbackLoading}
                        />
                        <small aria-live="polite">
                          {feedbackDraft.comment.length}/1000 characters
                        </small>
                      </label>
                      {feedbackError && (
                        <div
                          className="customer-alert customer-alert-error"
                          role="alert"
                        >
                          {feedbackError}
                        </div>
                      )}
                      <button
                        className="customer-button customer-button-primary"
                        type="submit"
                        disabled={feedbackLoading}
                      >
                        {feedbackLoading && (
                          <span
                            className="booking-spinner"
                            aria-hidden="true"
                          />
                        )}
                        {feedbackLoading
                          ? "Saving feedback..."
                          : editingFeedback
                            ? "Save changes"
                            : "Submit Feedback"}
                      </button>
                      {editingFeedback && (
                        <button
                          className="customer-button customer-button-outline"
                          type="button"
                          disabled={feedbackLoading}
                          onClick={() => setEditingFeedback(false)}
                        >
                          Keep existing feedback
                        </button>
                      )}
                    </form>
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
      {confirmCancel && appointment && (
        <ConfirmDialog
          title="Cancel this appointment?"
          confirmLabel="Cancel Appointment"
          busy={cancelLoading}
          onConfirm={cancel}
          onCancel={() => setConfirmCancel(false)}
          triggerRef={cancelTrigger}
        >
          <p>
            This cannot be undone. You are cancelling{" "}
            <strong>{serviceName}</strong> on{" "}
            <strong>{formatDate(appointment.date)}</strong> at{" "}
            <strong>{formatTime(appointment.startTime)}</strong>.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AppointmentPage;
