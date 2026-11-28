import { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import DatePicker from "../booking/DatePicker.jsx";
import { TimeSlotGrid } from "../booking/BookingComponents.jsx";
import { formatDate, formatTime, toDateOnly } from "../booking/bookingUtils.js";
import { getAvailability, rescheduleAppointment } from "../../services/bookingApi.js";
import "../../styles/booking.css";

/**
 * Pick a new date and time for one of the customer's appointments. Used by
 * the dashboard, the appointments list and the appointment details page.
 *
 * `appointment` needs: _id, service (with _id) or serviceId, serviceName or
 * service.name, date, startTime, and optionally durationMinutes.
 */
function RescheduleModal({ appointment, token, onClose, onRescheduled }) {
  const serviceId = appointment.service?._id || appointment.serviceId || appointment.service;
  const serviceName =
    appointment.serviceName || appointment.service?.name || "Salon service";
  const currentDate = toDateOnly(appointment.date);
  const [date, setDate] = useState(currentDate);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(Boolean(serviceId));
  const [slotsError, setSlotsError] = useState("");
  const [slotRetry, setSlotRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(
    serviceId ? "" : "This appointment has no service assigned, so it can't be moved online.",
  );

  useEffect(() => {
    if (!serviceId || !date) return undefined;
    let active = true;
    getAvailability({
      serviceId,
      date,
      excludeAppointmentId: appointment._id,
      token,
    })
      .then((result) => {
        if (!active) return;
        setSlots(result.slots || []);
        setSlotsError("");
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
        if (active) {
          setSlots([]);
          setSlotsError(
            requestError.message || "We couldn't load available times.",
          );
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointment._id, serviceId, date, token, slotRetry]);

  const chooseDate = (value) => {
    setDate(value);
    setSlot(null);
    setSlotsLoading(true);
    setError("");
  };

  const isCurrentTime =
    slot && date === currentDate && slot.startTime === appointment.startTime;

  const submit = async (event) => {
    event.preventDefault();
    if (!slot?.available || isCurrentTime || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await rescheduleAppointment(appointment._id, {
        date,
        startTime: slot.startTime,
        token,
      });
      onRescheduled(result.appointment || result);
    } catch (requestError) {
      if (requestError.status === 409) {
        // Someone else booked the slot while you were choosing.
        setSlot(null);
        setSlotsLoading(true);
        setSlotRetry((value) => value + 1);
        setError("That time was just taken. Please choose another one.");
      } else {
        setError(
          requestError.message || "We couldn't reschedule this appointment.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={() => !saving && onClose()}
      size="wide"
      className="booking-scope customer-reschedule-modal"
    >
      <Modal.Header>
        <div>
          <Modal.Eyebrow>Reschedule</Modal.Eyebrow>
          <Modal.Title>{serviceName}</Modal.Title>
          <Modal.Description>
            Pick a new date, then choose one of the salon’s open times.
          </Modal.Description>
        </div>
        <Modal.Close label="Close without rescheduling" />
      </Modal.Header>
      <Modal.Body>
        <div className="booking-comparison">
          <div>
            <strong>Current time</strong>
            <span>
              {formatDate(appointment.date)} · {formatTime(appointment.startTime)}
            </span>
          </div>
          <div>
            <strong>New time</strong>
            <span>
              {slot && !isCurrentTime
                ? `${formatDate(date)} · ${formatTime(slot.startTime)}`
                : "Choose a date and time"}
            </span>
          </div>
        </div>
        {error && (
          <p className="ui-note ui-note--error" role="alert">
            {error}
          </p>
        )}
        <form id="customer-reschedule-form" onSubmit={submit}>
          {serviceId && (
            <>
              <DatePicker
                value={date}
                onChange={chooseDate}
                serviceDuration={appointment.durationMinutes || 30}
              />
              <div className="booking-slot-section">
                <h3>Available times</h3>
                <TimeSlotGrid
                  slots={slots}
                  selectedTime={slot?.startTime}
                  onSelect={setSlot}
                  loading={slotsLoading}
                  error={slotsError}
                  onRetry={() => {
                    setSlotsError("");
                    setSlotsLoading(true);
                    setSlotRetry((value) => value + 1);
                  }}
                />
              </div>
            </>
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <button
          className="customer-button customer-button-outline"
          type="button"
          onClick={onClose}
          disabled={saving}
        >
          Keep Current Time
        </button>
        <button
          className="customer-button customer-button-primary"
          type="submit"
          form="customer-reschedule-form"
          disabled={!slot?.available || isCurrentTime || saving}
        >
          {saving ? (
            <>
              <span className="ui-spinner" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Confirm New Time"
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default RescheduleModal;
