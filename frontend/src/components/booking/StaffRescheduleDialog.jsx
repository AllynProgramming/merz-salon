import { useEffect, useState } from "react";
import { bookingSchedule } from "../../config/bookingSchedule.js";
import {
  formatDate,
  toDateOnly,
} from "./bookingUtils.js";
import {
  getStaffAvailability,
  rescheduleStaffAppointment,
} from "../../services/bookingApi.js";
import Modal from "../ui/Modal.jsx";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function StaffRescheduleDialog({
  appointment,
  token,
  onClose,
  onRescheduled,
}) {
  const [date, setDate] = useState(() => toDateOnly(appointment.date));
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [bounds] = useState(() => {
    const today = new Date();
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + bookingSchedule.maximumDaysAhead);
    return { minimum: dateKey(today), maximum: dateKey(lastDate) };
  });

  useEffect(() => {
    let active = true;
    getStaffAvailability({
      serviceId: appointment.service?._id || appointment.serviceId,
      date,
      excludeAppointmentId: appointment._id,
      token,
    })
      .then((result) => {
        if (active) {
          setSlots(result.slots || []);
          setError("");
          setSelectedTime((current) =>
            current &&
            result.slots?.some(
              (slot) => slot.startTime === current && slot.available,
            )
              ? current
              : "",
          );
        }
      })
      .catch((requestError) => {
        if (active) {
          setSlots([]);
          setError(
            requestError.message || "Could not load available appointment times.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointment, date, retry, token]);

  const availableSlots = slots.filter(
    (slot) => slot.available && slot.startTime,
  );
  const currentDate = toDateOnly(appointment.date);

  const submit = async (event) => {
    event.preventDefault();
    if (
      !selectedTime ||
      (date === currentDate && selectedTime === appointment.startTime)
    ) {
      setError("Choose a different available date or time.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await rescheduleStaffAppointment(appointment._id, {
        date,
        startTime: selectedTime,
        token,
      });
      onRescheduled(response.appointment || response);
    } catch (requestError) {
      if (requestError.status === 409) {
        setSelectedTime("");
        setError("That time was just taken. Choose another available slot.");
        setRetry((value) => value + 1);
      } else {
        setError(requestError.message || "Could not reschedule this appointment.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={() => !saving && onClose()} size="wide" className="staff-reschedule-modal">
      <Modal.Header>
        <div>
          <Modal.Eyebrow>Appointment changes</Modal.Eyebrow>
          <Modal.Title>Reschedule appointment</Modal.Title>
          <Modal.Description>
            {appointment.customerName || "Customer"} ·{" "}
            {appointment.serviceName || "Salon service"}
          </Modal.Description>
        </div>
        <Modal.Close label="Close without rescheduling" />
      </Modal.Header>
      <Modal.Body>
        <form id="staff-reschedule-form" onSubmit={submit}>

          <div className="staff-reschedule__current">
            <strong>Current appointment</strong>
            <span>
              {formatDate(appointment.date)} · {formatTime(appointment.startTime)}
            </span>
          </div>

          {error && (
            <div className="customer-alert customer-alert-error" role="alert">
              {error}
            </div>
          )}

          <label className="staff-reschedule__field">
            <span>New date</span>
            <input
              type="date"
              value={date}
              min={bounds.minimum}
              max={bounds.maximum}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedTime("");
                setError("");
                setLoading(true);
              }}
              required
            />
          </label>

          <fieldset className="staff-reschedule__times">
            <legend>Available times</legend>
            {loading ? (
              <p role="status">Checking available times…</p>
            ) : availableSlots.length ? (
              <div className="staff-reschedule__slots">
                {availableSlots.map((slot) => {
                  const isCurrent =
                    date === currentDate &&
                    slot.startTime === appointment.startTime;
                  return (
                    <label
                      className={`staff-reschedule__slot${selectedTime === slot.startTime ? " is-selected" : ""}${isCurrent ? " is-current" : ""}`}
                      key={slot.startTime}
                    >
                      <input
                        type="radio"
                        name="rescheduleTime"
                        value={slot.startTime}
                        checked={selectedTime === slot.startTime}
                        disabled={isCurrent}
                        onChange={() => {
                          setSelectedTime(slot.startTime);
                          setError("");
                        }}
                      />
                      <span>{formatTime(slot.startTime)}</span>
                      {isCurrent && <small>Current</small>}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p>No available times for this date. Try another date.</p>
            )}
          </fieldset>

        </form>
      </Modal.Body>
      <Modal.Footer>
        <button
          className="customer-button customer-button-outline"
          type="button"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="customer-button customer-button-primary"
          type="submit"
          form="staff-reschedule-form"
          disabled={
            loading ||
            saving ||
            !selectedTime ||
            (date === currentDate && selectedTime === appointment.startTime)
          }
        >
          {saving ? (
            <>
              <span className="ui-spinner" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save new time"
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default StaffRescheduleDialog;
