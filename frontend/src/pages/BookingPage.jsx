import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Link,
  useBlocker,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import DatePicker from "../components/booking/DatePicker.jsx";
import StarRating from "../components/customer/StarRating.jsx";
import {
  BookingSummary,
  Stepper,
  TimeSlotGrid,
  Toast,
} from "../components/booking/BookingComponents.jsx";
import {
  formatDate,
  formatDuration,
  formatPrice,
} from "../components/booking/bookingUtils.js";
import useAuth from "../context/useAuth.js";
import {
  createAppointment,
  getAvailability,
  getAvailabilityCalendar,
  getServices,
} from "../services/bookingApi.js";
import { bookingSchedule } from "../config/bookingSchedule.js";
import "../styles/booking.css";

const steps = ["Service", "Date", "Time", "Review", "Confirmation"];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDateRange() {
  const today = new Date();
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + bookingSchedule.maximumDaysAhead);
  return { from: localDateKey(today), to: localDateKey(lastDate) };
}

function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const initialService = searchParams.get("service") || "";
  const [step, setStep] = useState(() => (initialService ? 1 : 0));
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [serviceId, setServiceId] = useState(initialService);
  const [dateAvailability, setDateAvailability] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(
    Boolean(initialService),
  );
  const [calendarError, setCalendarError] = useState("");
  const [calendarRetry, setCalendarRetry] = useState(0);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [slotRetry, setSlotRetry] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedService = services.find((service) => service._id === serviceId);
  const dirty = Boolean(serviceId || date || slot);
  const allowNavigation = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowNavigation.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  const { state: blockerState, proceed, reset } = blocker;

  useEffect(() => {
    let active = true;
    getServices()
      .then((items) => {
        if (active) setServices(items);
      })
      .catch((requestError) => {
        if (active) setServicesError(requestError.message);
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!serviceId || step !== 1) return undefined;

    let active = true;
    const range = getCalendarDateRange();
    getAvailabilityCalendar({ serviceId, ...range, token })
      .then((result) => {
        if (active) {
          setDateAvailability(
            Object.fromEntries(
              (result.days || []).map((day) => [day.date, day]),
            ),
          );
          setCalendarError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setDateAvailability({});
          setCalendarError(
            requestError.message || "We couldn't load date availability.",
          );
        }
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });

    return () => {
      active = false;
    };
  }, [serviceId, token, calendarRetry, step]);

  useEffect(() => {
    if (!serviceId || !date) return undefined;
    let active = true;
    getAvailability({ serviceId, date, token })
      .then((result) => {
        if (!active) return;
        setSlots(result.slots || []);
        setSlotsError("");
        setSlot((current) => {
          if (!current) return null;
          const stillAvailable = (result.slots || []).find(
            (item) => item.startTime === current.startTime,
          )?.available;
          return stillAvailable ? current : null;
        });
      })
      .catch((requestError) => {
        if (active)
          setSlotsError(
            requestError.message || "We couldn't load available times.",
          );
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [serviceId, date, token, slotRetry]);

  useEffect(() => {
    if (blockerState !== "blocked") return;
    if (
      window.confirm(
        "Leave this booking? Your selected service, date, and time will be lost.",
      )
    )
      proceed();
    else reset();
  }, [blockerState, proceed, reset]);

  const chooseService = (service) => {
    setServiceId(service._id);
    setDateAvailability(null);
    setCalendarLoading(true);
    setCalendarError("");
    setDate("");
    setSlots([]);
    setSlot(null);
    setSlotsError("");
  };

  const chooseDate = (value) => {
    setDate(value);
    setSlots([]);
    setSlot(null);
    setSlotsLoading(true);
    setSlotsError("");
  };

  const refreshSlots = () => {
    setSlotsError("");
    setSlotsLoading(true);
    setSlotRetry((value) => value + 1);
  };

  const refreshCalendar = () => {
    setDateAvailability(null);
    setCalendarLoading(true);
    setCalendarError("");
    setCalendarRetry((value) => value + 1);
  };

  const next = () => {
    setError("");
    if (step === 0 && !selectedService)
      return setError("Choose a service to continue.");
    if (step === 1 && !date)
      return setError("Choose an available date to continue.");
    if (step === 2 && !slot?.available)
      return setError("Choose an available time to continue.");
    setStep((value) => Math.min(value + 1, 3));
  };

  const back = () => {
    setError("");
    if (step === 2) {
      setDateAvailability(null);
      setCalendarLoading(true);
      setCalendarError("");
    }
    setStep((value) => Math.max(value - 1, 0));
  };

  const confirmBooking = async () => {
    setSubmitLoading(true);
    setError("");
    try {
      const response = await createAppointment({
        serviceId,
        date,
        startTime: slot.startTime,
        token,
      });
      const appointment = response.appointment || response;
      allowNavigation.current = true;
      navigate(`/appointments/${appointment._id}/confirmation`, {
        state: { appointment },
        replace: true,
      });
    } catch (requestError) {
      if (requestError.status === 409) {
        setStep(2);
        setSlot(null);
        setSlotsLoading(true);
        setSlotRetry((value) => value + 1);
        setError("That time was just taken. Please choose another slot.");
      } else {
        setError(
          requestError.message ||
            "We couldn't confirm this appointment. Try again.",
        );
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Book an Appointment | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Appointment booking</p>
            <h1>Choose a time for you</h1>
            <p className="booking-lede">
              Select a service, date, and available time, then review the
              details.
            </p>
          </div>
        </header>
        <Stepper steps={steps} currentStep={step} />
        <Toast message={error} variant="error" onDismiss={() => setError("")} />

        {servicesError ? (
          <div className="booking-state booking-state-error" role="alert">
            <span>{servicesError}</span>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : servicesLoading ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading services...
          </div>
        ) : (
          <div className="booking-step-layout">
            <section className="booking-panel" aria-live="polite">
              {step === 0 && (
                <>
                  <h2>Select a service</h2>
                  <p className="booking-panel-intro">
                    Choose one service to see appointment times.
                  </p>
                  {!services.length ? (
                    <div className="booking-state">
                      <h3>No services available</h3>
                      <p>There are no active services to book right now.</p>
                    </div>
                  ) : (
                    <div className="booking-service-grid">
                      {services.map((service) => (
                        <button
                          className={`booking-service-card is-compact ${serviceId === service._id ? "booking-selected-card" : ""}`}
                          type="button"
                          aria-pressed={serviceId === service._id}
                          onClick={() => chooseService(service)}
                          key={service._id}
                        >
                          <span className="booking-service-topline">
                            <span className="booking-category-label">
                              {service.category || "Service"}
                            </span>
                            <span className="booking-duration">
                              {formatDuration(service.durationMinutes)}
                            </span>
                          </span>
                          <h3>{service.name}</h3>
                          <p className="booking-service-description">
                            {service.description}
                          </p>
                          <div className="booking-service-meta">
                            {Number(service.ratingCount) > 0 ? (
                              <>
                                <StarRating value={service.averageRating} />
                                <small>
                                  {Number(service.averageRating).toFixed(1)} (
                                  {service.ratingCount})
                                </small>
                              </>
                            ) : (
                              <small>No ratings yet</small>
                            )}
                          </div>
                          <strong>{formatPrice(service.price)}</strong>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <h2>Select a date</h2>
                  <p className="booking-panel-intro">
                    Available dates and times reflect staff schedules and
                    existing bookings for{" "}
                    {selectedService?.name || "your service"}.
                  </p>
                  {selectedService ? (
                    <>
                      <DatePicker
                        value={date}
                        onChange={chooseDate}
                        serviceDuration={selectedService.durationMinutes}
                        availabilityByDate={
                          calendarLoading ? undefined : dateAvailability || {}
                        }
                        availabilityLoading={calendarLoading}
                      />
                      {calendarError && (
                        <div className="booking-calendar-error" role="alert">
                          <span>{calendarError}</span>
                          <button
                            className="booking-button booking-button-outline"
                            type="button"
                            onClick={refreshCalendar}
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="booking-state booking-state-error">
                      That service is no longer available.{" "}
                      <Link to="/services">Choose another service</Link>.
                    </div>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <h2>Select a time</h2>
                  <p className="booking-panel-intro">
                    {date ? formatDate(date) : "Choose a date first."}
                  </p>
                  <TimeSlotGrid
                    slots={slots}
                    selectedTime={slot?.startTime}
                    onSelect={setSlot}
                    loading={slotsLoading}
                    error={slotsError}
                    onRetry={refreshSlots}
                  />
                </>
              )}
              {step === 3 && (
                <>
                  <h2>Review and confirm</h2>
                  <p className="booking-panel-intro">
                    Check your appointment details before confirming.
                  </p>
                  <BookingSummary
                    service={selectedService}
                    date={date}
                    startTime={slot?.startTime}
                    endTime={slot?.endTime}
                  />
                  <p className="booking-review-note">
                    Your request stays pending while staff confirms it. If
                    you’re running late, contact the salon so they can help
                    with your booking.
                  </p>
                </>
              )}
              <div className="booking-action-row">
                <button
                  className="booking-button booking-button-outline"
                  type="button"
                  onClick={back}
                  disabled={step === 0 || submitLoading}
                >
                  Back
                </button>
                {step < 3 ? (
                  <button
                    className="booking-button booking-button-primary"
                    type="button"
                    onClick={next}
                    disabled={
                      (step === 0 && !selectedService) ||
                      (step === 1 && !date) ||
                      (step === 2 && (!slot?.available || slotsLoading))
                    }
                  >
                    Next
                  </button>
                ) : (
                  <button
                    className="booking-button booking-button-primary"
                    type="button"
                    onClick={confirmBooking}
                    disabled={submitLoading}
                  >
                    {submitLoading && (
                      <span className="booking-spinner" aria-hidden="true" />
                    )}
                    {submitLoading ? "Confirming..." : "Confirm Booking"}
                  </button>
                )}
              </div>
            </section>
            <aside
              className="booking-summary-panel"
              aria-label="Booking summary"
            >
              <h2>Your selection</h2>
              <BookingSummary
                service={selectedService}
                date={date}
                startTime={slot?.startTime}
                endTime={slot?.endTime}
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default BookingPage;
