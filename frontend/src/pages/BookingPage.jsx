import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  useBlocker,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import DatePicker from "../components/booking/DatePicker.jsx";
import {
  BookingSummary,
  ServiceDuration,
  ServiceFilters,
  ServiceRating,
  Stepper,
  TimeSlotGrid,
} from "../components/booking/BookingComponents.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import {
  formatDate,
  formatPrice,
  formatTime,
  isMostLoved,
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

const steps = ["Service", "Date & time", "Review", "Confirmation"];
const REVIEW_STEP = 2;


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
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [slotRetry, setSlotRetry] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCategory, setServiceCategory] = useState("All");
  const timesRef = useRef(null);
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


  const chooseService = (service) => {
    goToStep(1);
    if (service._id === serviceId) return;
    setServiceId(service._id);
    setDateAvailability(null);
    setCalendarLoading(true);
    setCalendarError("");
    setDate("");
    setSlots([]);
    setSlot(null);
    setSelectedStaffId("");
    setSlotsError("");
  };

  const chooseDate = (value) => {
    setDate(value);
    setSlots([]);
    setSlot(null);
    setSelectedStaffId("");
    setSlotsLoading(true);
    setSlotsError("");
    setError("");
    // Bring the times into view, which matters most on small screens.
    window.requestAnimationFrame(() =>
      timesRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
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

  const goToStep = (target) => {
    setError("");
    // Coming back to the calendar reloads which dates are open.
    if (target === 1 && step !== 1) {
      setDateAvailability(null);
      setCalendarLoading(true);
      setCalendarError("");
    }
    setStep(target);
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    setError("");
    if (step === 0 && !selectedService)
      return setError("Choose a service to continue.");
    if (step === 1 && !date)
      return setError("Choose an available date to continue.");
    if (step === 1 && !slot?.available)
      return setError("Choose an available time to continue.");
    goToStep(Math.min(step + 1, REVIEW_STEP));
  };

  const back = () => goToStep(Math.max(step - 1, 0));

  const serviceCategories = useMemo(
    () =>
      [...new Set(services.map((service) => service.category || "Other"))].sort(),
    [services],
  );
  const serviceQuery = serviceSearch.trim().toLowerCase();
  const searchedServices = services.filter(
    (service) =>
      !serviceQuery ||
      `${service.name} ${service.description || ""} ${service.category || ""}`
        .toLowerCase()
        .includes(serviceQuery),
  );
  const serviceCounts = searchedServices.reduce(
    (totals, service) => {
      const key = service.category || "Other";
      totals[key] = (totals[key] || 0) + 1;
      return totals;
    },
    { All: searchedServices.length },
  );
  const pickableServices = searchedServices
    .filter(
      (service) =>
        serviceCategory === "All" ||
        (service.category || "Other") === serviceCategory,
    )
    .sort((first, second) => first.name.localeCompare(second.name));
  const selectedStaff = slot?.availableStaff?.find(
    (staff) => String(staff._id) === selectedStaffId,
  );

  const confirmBooking = async () => {
    setSubmitLoading(true);
    setError("");
    try {
      const response = await createAppointment({
        serviceId,
        date,
        startTime: slot.startTime,
        staffId: selectedStaffId || undefined,
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
        setStep(1);
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
      <main id="main-content" tabIndex={-1} className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Appointment booking</p>
            <h1>Book your visit</h1>
            <p className="booking-lede">
              Choose a service, pick a time that suits you, and confirm. It
              takes about a minute.
            </p>
          </div>
        </header>
        <Stepper steps={steps} currentStep={step} />
        {error && (
          <div className="booking-form-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {servicesError ? (
          <div className="booking-state booking-state-error" role="alert">
            <span>{servicesError}</span>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : servicesLoading ? (
          <div className="booking-state" role="status" aria-busy="true">
            Loading services…
          </div>
        ) : (
          <div className="booking-step-layout">
            <section className="booking-panel">
              {step === 0 && (
                <>
                  <h2>Select a service</h2>
                  <p className="booking-panel-intro">
                    Tap a service to see the days and times it’s available.
                  </p>
                  {!services.length ? (
                    <div className="booking-state">
                      <h3>No services available</h3>
                      <p>There are no active services to book right now.</p>
                    </div>
                  ) : (
                    <>
                      <ServiceFilters
                        categories={serviceCategories}
                        counts={serviceCounts}
                        category={serviceCategory}
                        onCategory={setServiceCategory}
                        search={serviceSearch}
                        onSearch={setServiceSearch}
                      />
                      {pickableServices.length ? (
                        <div className="booking-service-grid booking-service-grid--pick">
                          {pickableServices.map((service) => {
                            const selected = serviceId === service._id;
                            return (
                              <button
                                className={`booking-service-card is-compact${selected ? " booking-selected-card" : ""}`}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => chooseService(service)}
                                key={service._id}
                              >
                                <span className="booking-service-topline">
                                  <span className="booking-category-label">
                                    {service.category || "Service"}
                                  </span>
                                  {selected ? (
                                    <span
                                      className="booking-service-check"
                                      aria-hidden="true"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    isMostLoved(service) && (
                                      <span className="booking-service-badge">
                                        Most loved
                                      </span>
                                    )
                                  )}
                                </span>
                                <span className="booking-service-pick-name">
                                  {service.name}
                                </span>
                                {service.description && (
                                  <span className="booking-service-description">
                                    {service.description}
                                  </span>
                                )}
                                <span className="booking-service-facts">
                                  <ServiceDuration
                                    minutes={service.durationMinutes}
                                  />
                                  <ServiceRating service={service} />
                                </span>
                                <strong className="booking-service-price">
                                  {formatPrice(service.price)}
                                </strong>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="booking-pick-empty">
                          <p>No services match “{serviceSearch.trim()}”.</p>
                          <button
                            className="booking-button booking-button-outline"
                            type="button"
                            onClick={() => {
                              setServiceSearch("");
                              setServiceCategory("All");
                            }}
                          >
                            Show all services
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  <h2>Pick a date and time</h2>
                  <p className="booking-panel-intro">
                    Days with open times for{" "}
                    <strong>{selectedService?.name || "your service"}</strong>{" "}
                    are selectable. Times reflect staff schedules and existing
                    bookings.
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
                      <div
                        className="booking-slot-section booking-times"
                        ref={timesRef}
                      >
                        <h3>
                          {date
                            ? `Open times on ${formatDate(date)}`
                            : "Open times"}
                        </h3>
                        {date ? (
                          <TimeSlotGrid
                            slots={slots}
                            selectedTime={slot?.startTime}
                            onSelect={(nextSlot) => {
                              setError("");
                              setSlot(nextSlot);
                              setSelectedStaffId(
                                (currentStaffId) =>
                                  nextSlot.availableStaff?.some(
                                    (staff) =>
                                      String(staff._id) === currentStaffId,
                                  )
                                    ? currentStaffId
                                    : String(
                                        nextSlot.availableStaff?.[0]?._id || "",
                                      ),
                              );
                            }}
                            loading={slotsLoading}
                            error={slotsError}
                            onRetry={refreshSlots}
                          />
                        ) : (
                          <p className="booking-times-hint">
                            Choose a day on the calendar to see its open times.
                          </p>
                        )}
                        {slot?.available && slot.availableStaff?.length > 0 && (
                          <label className="booking-staff-choice">
                            <span>Preferred staff member</span>
                            <select
                              value={selectedStaffId}
                              onChange={(event) =>
                                setSelectedStaffId(event.target.value)
                              }
                            >
                              {slot.availableStaff.map((staff) => (
                                <option key={staff._id} value={staff._id}>
                                  {staff.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="booking-state booking-state-error">
                      That service is no longer available.{" "}
                      <button
                        className="booking-text-link"
                        type="button"
                        onClick={() => goToStep(0)}
                      >
                        Choose another service
                      </button>
                      .
                    </div>
                  )}
                </>
              )}

              {step === REVIEW_STEP && (
                <>
                  <h2>Review and confirm</h2>
                  <p className="booking-panel-intro">
                    Check the details, then confirm your booking.
                  </p>
                  <dl className="booking-review-list">
                    <div>
                      <dt>Service</dt>
                      <dd>
                        <strong>{selectedService?.name}</strong>
                        <span>
                          {selectedService &&
                            `${formatPrice(selectedService.price)} · `}
                          <ServiceDuration
                            minutes={selectedService?.durationMinutes}
                          />
                        </span>
                      </dd>
                      <button type="button" onClick={() => goToStep(0)}>
                        Edit
                        <span className="booking-visually-hidden"> service</span>
                      </button>
                    </div>
                    <div>
                      <dt>Date and time</dt>
                      <dd>
                        <strong>{date ? formatDate(date) : "—"}</strong>
                        <span>
                          {slot
                            ? `${formatTime(slot.startTime)}${slot.endTime ? `–${formatTime(slot.endTime)}` : ""}`
                            : ""}
                        </span>
                      </dd>
                      <button type="button" onClick={() => goToStep(1)}>
                        Edit
                        <span className="booking-visually-hidden">
                          {" "}
                          date and time
                        </span>
                      </button>
                    </div>
                    {selectedStaff && (
                      <div>
                        <dt>Staff member</dt>
                        <dd>
                          <strong>{selectedStaff.name}</strong>
                        </dd>
                        <button type="button" onClick={() => goToStep(1)}>
                          Edit
                          <span className="booking-visually-hidden">
                            {" "}
                            staff member
                          </span>
                        </button>
                      </div>
                    )}
                  </dl>
                  <p className="booking-review-note">
                    Your request stays pending until the salon confirms it.
                    You’ll get a notification when it’s confirmed. Running late?
                    Contact the salon so they can help.
                  </p>
                </>
              )}

              <div className="booking-action-row booking-action-row--sticky">
                <button
                  className="booking-button booking-button-outline"
                  type="button"
                  onClick={back}
                  disabled={step === 0 || submitLoading}
                >
                  Back
                </button>
                {step < REVIEW_STEP ? (
                  <button
                    className="booking-button booking-button-primary"
                    type="button"
                    onClick={next}
                    disabled={
                      (step === 0 && !selectedService) ||
                      (step === 1 && (!slot?.available || slotsLoading))
                    }
                  >
                    {step === 0 ? "Choose Date & Time" : "Review Booking"}
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
                    {submitLoading ? "Confirming…" : "Confirm Booking"}
                  </button>
                )}
              </div>
            </section>
            <aside
              className="booking-summary-panel booking-summary-panel--sticky"
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
      {blockerState === "blocked" && (
        <ConfirmDialog
          title="Leave this booking?"
          description="Your selected service, date and time will be lost."
          confirmLabel="Leave Booking"
          cancelLabel="Keep Booking"
          tone="danger"
          onConfirm={proceed}
          onCancel={reset}
        />
      )}
    </div>
  );
}

export default BookingPage;
