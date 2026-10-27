import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import {
  formatDuration,
  formatPrice,
} from "../components/booking/bookingUtils.js";
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

function StaffBookingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [walkInMode, setWalkInMode] = useState(false);
  const [walkInCustomer, setWalkInCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [dateAvailability, setDateAvailability] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
  }, [serviceId, date, token]);

  const selectedService = services.find((service) => service._id === serviceId);

  const updateCustomerSearch = (event) => {
    const value = event.target.value;
    setCustomerSearch(value);
    setCustomer(null);
    setCustomers([]);
    setCustomersLoading(value.trim().length >= 2);
    setError("");
  };

  const updateWalkInCustomer = (event) => {
    const { name, value } = event.target;
    setWalkInCustomer((current) => ({ ...current, [name]: value }));
    setError("");
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
  };

  const updateDate = (value) => {
    setDate(value);
    setSlots([]);
    setStartTime("");
    setAvailabilityLoading(Boolean(value && serviceId));
    setError("");
  };

  const walkInReady =
    walkInMode &&
    walkInCustomer.name.trim().length >= 2 &&
    walkInCustomer.phone.trim().length >= 7;
  const customerReady = !walkInMode && Boolean(customer);
  const isFormReady =
    Boolean(walkInReady || customerReady) &&
    Boolean(serviceId) &&
    Boolean(date) &&
    Boolean(startTime);

  const submit = async (event) => {
    event.preventDefault();

    if (walkInMode) {
      if (!walkInCustomer.name.trim() || walkInCustomer.name.trim().length < 2) {
        setError(
          "Please enter the walk-in customer's full name (at least 2 characters).",
        );
        return;
      }
      if (
        !walkInCustomer.phone.trim() ||
        walkInCustomer.phone.trim().length < 7
      ) {
        setError(
          "Please enter a valid contact phone number (at least 7 characters).",
        );
        return;
      }
    } else if (!customer) {
      setError(
        "Please search and select a customer, or switch to Walk-in customer mode.",
      );
      return;
    }

    if (!serviceId) {
      setError("Please select a salon service.");
      return;
    }
    if (!date) {
      setError("Please select an appointment date.");
      return;
    }
    if (!startTime) {
      setError("Please select an available appointment time.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = walkInMode
        ? {
            walkInCustomer: {
              name: walkInCustomer.name.trim(),
              phone: walkInCustomer.phone.trim(),
              email: walkInCustomer.email.trim(),
            },
            serviceId,
            date,
            startTime,
          }
        : {
            customerId: customer._id,
            serviceId,
            date,
            startTime,
          };

      const response = await createStaffAppointment(payload, token);
      navigate(
        `/staff/book-appointment/${response.appointment._id}/success`,
        {
          state: {
            appointment: {
              ...response.appointment,
              isWalkIn: walkInMode,
            },
          },
        },
      );
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
              Choose an existing customer or book a walk-in guest, then select a
              service and appointment time.
            </p>
          </div>
          <Link className="customer-button customer-button-outline" to="/staff">
            Back to dashboard
          </Link>
        </header>

        {error && (
          <div className="booking-state booking-state-error" role="alert">
            {error}
          </div>
        )}
        {servicesError && (
          <div className="booking-state booking-state-error" role="alert">
            {servicesError}
          </div>
        )}

        <form className="staff-booking__form" onSubmit={submit}>
          <section className="customer-panel staff-booking__panel">
            <div className="staff-booking__panel-header">
              <h2>1. Customer details</h2>
              <div
                className="staff-booking__type-toggle"
                role="radiogroup"
                aria-label="Customer booking type"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!walkInMode}
                  className={`staff-booking__type-btn${!walkInMode ? " is-active" : ""}`}
                  onClick={() => {
                    if (walkInMode) {
                      setWalkInMode(false);
                      setError("");
                    }
                  }}
                >
                  <svg
                    className="staff-booking__tab-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 17v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 15.5V17" />
                    <circle cx="10" cy="7" r="3.5" />
                  </svg>
                  Registered Account
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={walkInMode}
                  className={`staff-booking__type-btn${walkInMode ? " is-active" : ""}`}
                  onClick={() => {
                    if (!walkInMode) {
                      setWalkInMode(true);
                      setCustomer(null);
                      setCustomerSearch("");
                      setCustomers([]);
                      setError("");
                    }
                  }}
                >
                  <svg
                    className="staff-booking__tab-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 17v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2" />
                    <circle cx="8" cy="7" r="3" />
                    <line x1="16" y1="8" x2="16" y2="14" />
                    <line x1="13" y1="11" x2="19" y2="11" />
                  </svg>
                  Walk-in (No Account)
                </button>
              </div>
            </div>

            {!walkInMode ? (
              <>
                <label className="staff-booking__field">
                  <span>Search customer by name, email, or phone</span>
                  <div className="staff-booking__input-wrap">
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={updateCustomerSearch}
                      placeholder="Enter at least 2 characters to search"
                      autoComplete="off"
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        className="staff-booking__input-clear"
                        onClick={() => {
                          setCustomerSearch("");
                          setCustomer(null);
                          setCustomers([]);
                        }}
                        aria-label="Clear customer search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
                {customer && (
                  <div className="staff-booking__selected-customer">
                    <div className="staff-booking__selected-customer-info">
                      <strong>{customer.name}</strong>
                      <span>{customer.email}</span>
                      {customer.phone && <span>{customer.phone}</span>}
                    </div>
                    <button
                      type="button"
                      className="customer-button customer-button-outline staff-booking__change-btn"
                      onClick={() => {
                        setCustomer(null);
                        setCustomerSearch("");
                        setCustomers([]);
                      }}
                    >
                      Change customer
                    </button>
                  </div>
                )}
                {!customer && customersLoading && (
                  <p className="staff-booking__status-text" role="status">
                    Searching customers…
                  </p>
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
                        <div className="staff-booking__no-results">
                          <p>
                            No customer accounts found for "
                            {customerSearch.trim()}".
                          </p>
                          <button
                            type="button"
                            className="customer-button customer-button-outline staff-booking__switch-walkin-btn"
                            onClick={() => {
                              setWalkInMode(true);
                              const trimmed = customerSearch.trim();
                              const isPhone = /^[\d\s+\-()]+$/.test(trimmed);
                              const isEmail = trimmed.includes("@");
                              setWalkInCustomer((prev) => ({
                                ...prev,
                                name:
                                  !isPhone && !isEmail ? trimmed : prev.name,
                                phone: isPhone ? trimmed : prev.phone,
                                email: isEmail ? trimmed : prev.email,
                              }));
                              setCustomerSearch("");
                              setCustomers([]);
                              setError("");
                            }}
                          >
                            Book as Walk-in Customer instead
                          </button>
                        </div>
                      )}
                    </div>
                  )}
              </>
            ) : (
              <div className="staff-booking__walkin-container">
                <div className="staff-booking__walkin-notice">
                  <svg
                    className="staff-booking__walkin-notice-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="10" cy="10" r="9" />
                    <line x1="10" y1="8" x2="10" y2="14" />
                    <line
                      x1="10"
                      y1="5.5"
                      x2="10.01"
                      y2="5.5"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <div>
                    <strong>Walk-in guest (no account needed)</strong>
                    <p>
                      Enter the guest's contact information below to schedule
                      and confirm their salon appointment.
                    </p>
                  </div>
                </div>

                <div className="staff-booking__walkin-grid">
                  <label className="staff-booking__field">
                    <span>
                      Guest full name{" "}
                      <strong className="staff-booking__req">*</strong>
                    </span>
                    <input
                      type="text"
                      name="name"
                      value={walkInCustomer.name}
                      onChange={updateWalkInCustomer}
                      placeholder="e.g. Maria Santos"
                      required
                      autoComplete="off"
                    />
                  </label>

                  <label className="staff-booking__field">
                    <span>
                      Phone number{" "}
                      <strong className="staff-booking__req">*</strong>
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={walkInCustomer.phone}
                      onChange={updateWalkInCustomer}
                      placeholder="e.g. 0917 123 4567"
                      required
                      autoComplete="off"
                    />
                  </label>
                </div>

                <label className="staff-booking__field">
                  <span>
                    Email address{" "}
                    <small>(Optional – for appointment updates)</small>
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={walkInCustomer.email}
                    onChange={updateWalkInCustomer}
                    placeholder="e.g. guest@example.com"
                    autoComplete="off"
                  />
                </label>
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
                    calendarLoading ? undefined : dateAvailability || {}
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
                <ul
                  className="staff-booking__availability-legend"
                  aria-label="Time slot availability"
                >
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
                !isFormReady
              }
            >
              {submitting
                ? "Booking…"
                : walkInMode
                  ? "Book Walk-In Appointment"
                  : "Book Appointment"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default StaffBookingPage;
