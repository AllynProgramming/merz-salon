import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import StarRating from "./StarRating.jsx";
import useConfirm from "../ui/useConfirm.jsx";
import { formatDate } from "../booking/bookingUtils.js";
import {
  submitAppointmentFeedback,
  updateAppointmentFeedback,
} from "../../services/bookingApi.js";

const ratingWords = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * Leave or edit feedback for a completed appointment. Pass `feedback` to
 * edit an existing review.
 */
function FeedbackModal({ appointment, feedback, token, onClose, onSaved }) {
  const initial = {
    rating: feedback?.rating || 0,
    comment: feedback?.comment || "",
  };
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const serviceName =
    appointment.serviceName || appointment.service?.name || "your visit";
  const dirty =
    draft.rating !== initial.rating || draft.comment !== initial.comment;

  const requestClose = async () => {
    if (saving) return;
    if (
      dirty &&
      !(await confirm({
        title: "Discard your feedback?",
        description: "What you wrote hasn't been sent yet.",
        confirmLabel: "Discard",
        cancelLabel: "Keep Writing",
        tone: "danger",
      }))
    ) {
      return;
    }
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.rating) {
      setError("Choose a star rating before sending your feedback.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = feedback
        ? await updateAppointmentFeedback({
            feedbackId: feedback._id,
            rating: draft.rating,
            comment: draft.comment.trim(),
            token,
          })
        : await submitAppointmentFeedback({
            appointmentId: appointment._id,
            rating: draft.rating,
            comment: draft.comment.trim(),
            token,
          });
      onSaved(result.feedback, feedback ? "updated" : "created");
    } catch (requestError) {
      setError(requestError.message || "We couldn't save your feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal onClose={requestClose}>
        <Modal.Header>
          <div>
            <Modal.Eyebrow>{feedback ? "Edit feedback" : "Rate your visit"}</Modal.Eyebrow>
            <Modal.Title>How was {serviceName}?</Modal.Title>
            {appointment.date && (
              <Modal.Description>
                Your visit on {formatDate(appointment.date)}. Your rating helps
                other customers choose and helps the salon improve.
              </Modal.Description>
            )}
          </div>
          <Modal.Close label="Close without sending" />
        </Modal.Header>
        <Modal.Body>
          {error && (
            <p className="ui-note ui-note--error" role="alert">
              {error}
            </p>
          )}
          <form
            id="customer-feedback-form"
            className="ui-form ui-form--single"
            onSubmit={submit}
          >
            <div className="ui-field">
              <span id="customer-feedback-rating-label">Your rating</span>
              <div className="customer-feedback-rating">
                <StarRating
                  value={draft.rating}
                  interactive
                  disabled={saving}
                  onChange={(rating) => {
                    setDraft((current) => ({ ...current, rating }));
                    setError("");
                  }}
                />
                <span className="customer-feedback-rating-word" aria-live="polite">
                  {ratingWords[draft.rating] || "Tap a star"}
                </span>
              </div>
            </div>
            <label className="ui-field">
              Comments (optional)
              <textarea
                name="comment"
                value={draft.comment}
                rows={4}
                maxLength={1000}
                autoComplete="off"
                placeholder="What did you like? What could be better…"
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    comment: event.target.value,
                  }))
                }
              />
              <span className="ui-field__hint ui-tabular">
                {draft.comment.length}/1000 characters
              </span>
            </label>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="customer-button customer-button-outline"
            type="button"
            onClick={requestClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="customer-button customer-button-primary"
            type="submit"
            form="customer-feedback-form"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="ui-spinner" aria-hidden="true" />
                Sending…
              </>
            ) : feedback ? (
              "Save Changes"
            ) : (
              "Send Feedback"
            )}
          </button>
        </Modal.Footer>
      </Modal>
      {confirmDialog}
    </>
  );
}

export default FeedbackModal;
