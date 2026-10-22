import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import { formatDuration, formatPrice } from "../components/booking/bookingUtils.js";
import DatePicker from "../components/booking/DatePicker.jsx";
import { bookingSchedule } from "../config/bookingSchedule.js";
import {
  createStaffAppointment,
  getServices,
  getStaffAvailabilityCalendar,
  getStaffAvailability,
  searchBookingCustomers,
} from "../services/bookingApi.js";
import "../styles/booking.css";
import "../styles/admin-dashboard.css";
import "../styles/staff-services.css";
import "../styles/staff-booking.css";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateBounds() {
  const today = new Date();
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + bookingSchedule.maximumDaysAhead);
  return {
    minimum: localDateKey(today),
    maximum: localDateKey(lastDate),
  };
}

function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(
    new Date(year, month - 1, day),
  );
}

function StaffBookingPage() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [dateAvailability, setDateAvailability] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    getServices()
      .then((items) => {
        if (active) setServices(items);
      })
      .catch((requestError) => {
        if (active)
          setServicesError(
            requestError.message || "Could not load available services.",
          );
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!serviceId) return undefined;

    let active = true;
    const bounds = getDateBounds();
    getStaffAvailabilityCalendar({
      serviceId,
      from: bounds.minimum,
      to: bounds.maximum,
      token,
    })
      .then((result) => {
        if (active) {
          setDateAvailability(
            Object.fromEntries(
              (result.days || []).map((day) => [day.date, day]),
            ),
          );
        }
      })
      .catch((requestError) => {
        if (active) {
          setDateAvailability({});
          setCalendarError(
            requestError.message || "Could not load date availability.",
          );
        }
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });

    return () => {
      active = false;
    };
  }, [serviceId, token, calendarRefresh]);

  useEffect(() => {
    const search = customerSearch.trim();
    if (customer || search.length < 2) {
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setCustomersLoading(true);
      searchBookingCustomers(search, token)
        .then((items) => {
          if (active) setCustomers(items);
        })
        .catch((requestError) => {
          if (active) {
            setCustomers([]);
            setError(requestError.message || "Could not search customers.");
          }
        })
        .finally(() => {
          if (active) setCustomersLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [customer, customerSearch, token]);

  useEffect(() => {
    if (!serviceId || !date) {
      return undefined;
    }

    let active = true;
    getStaffAvailability({ serviceId, date, token })
      .then((availability) => {
        if (active) setSlots(availability.slots || []);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Could not load available times.");
        }
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [serviceId, date, token, slotRefresh]);

  const selectedService = services.find((service) => service._id === serviceId);

  const updateCustomerSearch = (event) => {
    const value = event.target.value;
    setCustomerSearch(value);
    setCustomer(null);
    setCustomers([]);
    setCustomersLoading(value.trim().length >= 2);
    setError("");
    setResult(null);
  };

  const updateService = (event) => {
    const value = event.target.value;
    setServiceId(value);
    setSlots([]);
    setStartTime("");
    setAvailabilityLoading(Boolean(value && date));
    setDateAvailability(null);
    setCalendarLoading(Boolean(value));
    setCalendarError("");
    setError("");
    setResult(null);
  };

  const updateDate = (value) => {
    setDate(value);
    setSlots([]);
    setStartTime("");
    setAvailabilityLoading(Boolean(value && serviceId));
    setError("");
    setResult(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!customer || !serviceId || !date || !startTime) {
      setError("Choose a customer, service, date, and available time.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await createStaffAppointment(
        {
          customerId: customer._id,
          serviceId,
          date,
          startTime,
        },
        token,
      );
      setResult(response.appointment);
      setStartTime("");
      setSlots([]);
      setAvailabilityLoading(true);
      setDateAvailability(null);
      setCalendarLoading(true);
      setCalendarError("");
      setSlotRefresh((version) => version + 1);
      setCalendarRefresh((version) => version + 1);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not book this appointment. Please choose another time.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-page salon-landing staff-booking-page">
      <Helmet>
        <title>Book for a Customer | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="booking-container staff-booking">
        <header className="booking-header staff-services__header admin-section-heading">
          <div>
            <p className="booking-eyebrow">Salon operations</p>
            <h1>Book for a Customer</h1>
            <p className="booking-lede">
              Choose an existing customer, service, and an available appointment
              time.
            </p>
          </div>
          <Link className="customer-button customer-button-outline" to="/admin">
            Back to dashboard
          </Link>
        </header>

        {error && (
          <div className="booking-state booking-state-error" role="alert">
            {error}
          </div>
        )}
        {result && (
          <div className="staff-booking__success" role="status">
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
              The appointment is confirmed and the customer has been notified.
            </p>
            <dl className="staff-booking__confirmation-details">
              <div>
                <dt>Customer</dt>
                <dd>{customer?.name || "Customer"}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{result.serviceName}</dd>
              </div>
              <div>
                <dt>Date and time</dt>
                <dd>
                  {formatDate(result.date)} · {formatTime(result.startTime)}
                  {result.endTime && `–${formatTime(result.endTime)}`}
                </dd>
              </div>
              <div>
                <dt>Booking reference</dt>
                <dd>{result.bookingReference}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Confirmed</dd>
              </div>
            </dl>
          </div>
        )}
        {servicesError && (
          <div className="booking-state booking-state-error" role="alert">
            {servicesError}
          </div>
        )}

        <form className="staff-booking__form" onSubmit={submit}>
          <section className="customer-panel staff-booking__panel">
            <h2>1. Choose a customer</h2>
            <label className="staff-booking__field">
              <span>Search by name, email, or phone</span>
              <input
                type="search"
                value={customerSearch}
                onChange={updateCustomerSearch}
                placeholder="Enter at least 2 characters"
                autoComplete="off"
              />
            </label>
            {customer && (
              <div className="staff-booking__selected-customer">
                <strong>{customer.name}</strong>
                <span>{customer.email}</span>
                {customer.phone && <span>{customer.phone}</span>}
              </div>
            )}
            {!customer && customersLoading && (
              <p role="status">Searching customers…</p>
            )}
            {!customer &&
              !customersLoading &&
              customerSearch.trim().length >= 2 && (
                <div className="staff-booking__customer-results">
                  {customers.length ? (
                    customers.map((item) => (
                      <button
                        type="button"
                        key={item._id}
                        onClick={() => {
                          setCustomer(item);
                          setCustomerSearch(item.name);
                          setError("");
                        }}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.email}</span>
                        {item.phone && <span>{item.phone}</span>}
                      </button>
                    ))
                  ) : (
                    <p>No customer accounts found.</p>
                  )}
                </div>
              )}
          </section>

          <section className="customer-panel staff-booking__panel">
            <h2>2. Select a service and date</h2>
            <label className="staff-booking__field">
              <span>Salon service</span>
              <select
                value={serviceId}
                onChange={updateService}
                required
                disabled={servicesLoading || services.length === 0}
              >
                <option value="">
                  {servicesLoading ? "Loading services…" : "Choose a service"}
                </option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name} · {formatPrice(service.price)} ·{" "}
                    {formatDuration(service.durationMinutes)}
                  </option>
                ))}
              </select>
            </label>
            {selectedService && (
              <div className="staff-booking__service-summary">
                <strong>{selectedService.name}</strong>
                <span>{formatPrice(selectedService.price)}</span>
                <span>
                  Estimated duration:{" "}
                  {formatDuration(selectedService.durationMinutes)}
                </span>
                {selectedService.description && (
                  <p>{selectedService.description}</p>
                )}
              </div>
            )}
            <div
              className="staff-booking__field"
              role="group"
              aria-labelledby="staff-booking-date-label"
            >
              <span id="staff-booking-date-label">Appointment date</span>
              {selectedService && (
                <DatePicker
                  value={date}
                  onChange={updateDate}
                  serviceDuration={selectedService.durationMinutes}
                  availabilityByDate={
                    calendarLoading
                      ? undefined
                      : dateAvailability || {}
                  }
                  availabilityLoading={calendarLoading}
                />
              )}
              {calendarError && (
                <div className="staff-booking__calendar-error" role="alert">
                  <span>{calendarError}</span>
                  <button
                    type="button"
                    className="customer-button customer-button-outline"
                    onClick={() => {
                      setDateAvailability(null);
                      setCalendarLoading(true);
                      setCalendarError("");
                      setCalendarRefresh((version) => version + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="customer-panel staff-booking__panel">
            <h2>3. Choose a time</h2>
            {!serviceId || !date ? (
              <p>Select a service and date to check available times.</p>
            ) : availabilityLoading ? (
              <p role="status">Checking availability…</p>
            ) : slots.length ? (
              <>
                <p className="staff-booking__availability-note">
                  Choose a green time. Muted times are unavailable and show why.
                </p>
                <ul className="staff-booking__availability-legend" aria-label="Time slot availability">
                  <li>
                    <span className="is-available" aria-hidden="true" />
                    Available
                  </li>
                  <li>
                    <span className="is-unavailable" aria-hidden="true" />
                    Unavailable
                  </li>
                </ul>
                <div className="staff-booking__slots">
                  {slots.map((slot) => (
                    <label
                      className={`staff-booking__slot${startTime === slot.startTime ? " is-selected" : ""}${slot.available ? "" : " is-unavailable"}`}
                      key={slot.startTime}
                      title={slot.available ? "Available" : slot.reason}
                    >
                      <input
                        type="radio"
                        name="appointmentTime"
                        value={slot.startTime}
                        checked={startTime === slot.startTime}
                        disabled={!slot.available}
                        onChange={() => {
                          setStartTime(slot.startTime);
                          setError("");
                          setResult(null);
                        }}
                      />
                      <span>{formatTime(slot.startTime)}</span>
                      {!slot.available && (
                        <small>{slot.reason || "Unavailable"}</small>
                      )}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="staff-booking__no-slots">
                No available times for this service and date. Try another date.
              </p>
            )}
          </section>

          <div className="staff-booking__submit">
            <button
              className="customer-button customer-button-primary"
              type="submit"
              disabled={
                submitting ||
                servicesLoading ||
                availabilityLoading ||
                !customer ||
                !serviceId ||
                !date ||
                !startTime
              }
            >
              {submitting ? "Booking…" : "Book appointment"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default StaffBookingPage;
