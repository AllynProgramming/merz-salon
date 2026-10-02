import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import StarRating from "../customer/StarRating.jsx";
import {
  formatDate,
  formatDuration,
  formatPrice,
  formatTime,
} from "./bookingUtils.js";

export function ServiceCard({ service, compact = false }) {
  const duration = formatDuration(service.durationMinutes);
  const rating = Number(service?.averageRating ?? 0);
  const ratingCount = Number(service?.ratingCount ?? 0);
  const starValue = Number.isFinite(rating) ? rating : 0;

  return (
    <article className={`booking-service-card ${compact ? "is-compact" : ""}`}>
      <div className="booking-service-topline">
        {service.category && (
          <span className="booking-category-label">{service.category}</span>
        )}
        <span className="booking-duration">{duration}</span>
      </div>
      <h3>{service.name}</h3>
      <p className="booking-service-description">{service.description}</p>
      <div className="booking-service-meta">
        <span className="booking-service-rating">
          {starValue > 0 && <StarRating value={starValue} />}
          {starValue > 0 && <small>{starValue.toFixed(1)}</small>}
        </span>
        <small>
          {starValue > 0
            ? `${ratingCount} review${ratingCount === 1 ? "" : "s"}`
            : "No ratings yet"}
        </small>
      </div>
      <div className="booking-service-footer">
        <strong>{formatPrice(service.price)}</strong>
        <Link
          className="booking-link-button"
          to={`/book-appointment?service=${encodeURIComponent(service._id)}`}
          aria-label={`Book ${service.name}`}
        >
          Book Now
        </Link>
      </div>
    </article>
  );
}

export function ServiceFilters({
  categories,
  category,
  onCategory,
  search,
  onSearch,
  sort,
  onSort,
}) {
  return (
    <div className="booking-filters">
      <label className="booking-search-field">
        <span>Search services</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Try haircut or color"
        />
      </label>
      <label className="booking-sort-field">
        <span>Sort by</span>
        <select value={sort} onChange={(event) => onSort(event.target.value)}>
          <option value="name">Service name</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="duration">Shortest duration</option>
        </select>
      </label>
      <div
        className="booking-category-filters"
        role="group"
        aria-label="Filter by category"
      >
        {["All", ...categories].map((item) => (
          <button
            className={`booking-filter-chip ${category === item ? "is-active" : ""}`}
            type="button"
            aria-pressed={category === item}
            onClick={() => onCategory(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({ steps, currentStep }) {
  return (
    <nav className="booking-stepper" aria-label="Appointment booking steps">
      <p className="booking-mobile-step">
        Step {currentStep + 1} of {steps.length}
      </p>
      <ol>
        {steps.map((step, index) => (
          <li
            className={
              index === currentStep
                ? "is-current"
                : index < currentStep
                  ? "is-complete"
                  : ""
            }
            aria-current={index === currentStep ? "step" : undefined}
            key={step}
          >
            <span className="booking-step-index" aria-hidden="true">
              {index < currentStep ? "✓" : index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  onSelect,
  loading,
  error,
  onRetry,
}) {
  if (loading) {
    return (
      <div
        className="booking-slot-skeleton"
        role="status"
        aria-label="Loading available times"
      >
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <span key={item} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="booking-state booking-state-error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (!slots.length) {
    return (
      <div className="booking-state">
        <h3>No slots available</h3>
        <p>Try another date to see more appointment times.</p>
      </div>
    );
  }

  const groups = [
    { label: "Morning", filter: (hour) => hour < 12 },
    { label: "Afternoon", filter: (hour) => hour >= 12 && hour < 17 },
    { label: "Evening", filter: (hour) => hour >= 17 },
  ];

  return (
    <div className="booking-slot-picker">
      <div className="booking-slot-legend">
        <span>
          <i className="is-available" /> Available
        </span>
        <span>
          <i className="is-unavailable" /> Booked or outside hours
        </span>
      </div>
      {groups.map((group) => {
        const groupSlots = slots.filter((slot) =>
          group.filter(Number(slot.startTime.slice(0, 2))),
        );
        if (!groupSlots.length) return null;
        return (
          <section
            className="booking-slot-group"
            aria-label={`${group.label} appointment times`}
            key={group.label}
          >
            <h3>{group.label}</h3>
            <div className="booking-slot-grid">
              {groupSlots.map((slot) => {
                const selected = selectedTime === slot.startTime;
                const label = `${formatTime(slot.startTime)}${slot.available ? "" : `, ${slot.reason || "Booked"}`}`;
                return (
                  <button
                    className={`booking-slot ${selected ? "is-selected" : ""} ${slot.available ? "" : "is-unavailable"}`}
                    type="button"
                    key={slot.startTime}
                    disabled={!slot.available}
                    aria-pressed={selected}
                    aria-label={label}
                    onClick={() => onSelect(slot)}
                  >
                    <span>{formatTime(slot.startTime)}</span>
                    {!slot.available && (
                      <small>{slot.reason || "Booked"}</small>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function BookingSummary({ service, date, startTime, endTime, status }) {
  return (
    <dl className="booking-summary">
      <div>
        <dt>Service</dt>
        <dd>{service?.name || "Choose a service"}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{date ? formatDate(date) : "Choose a date"}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>
          {startTime
            ? `${formatTime(startTime)}${endTime ? `–${formatTime(endTime)}` : ""}`
            : "Choose a time"}
        </dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{service ? formatDuration(service.durationMinutes) : "—"}</dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd>{service ? formatPrice(service.price) : "—"}</dd>
      </div>
      {status && (
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={status} />
          </dd>
        </div>
      )}
    </dl>
  );
}

export function StatusBadge({ status }) {
  const normalizedStatus = [
    "pending",
    "confirmed",
    "completed",
    "cancelled",
  ].includes(status)
    ? status
    : "pending";
  const icon = {
    pending: "◷",
    confirmed: "✓",
    completed: "✓",
    cancelled: "×",
  }[normalizedStatus];

  return (
    <span
      className={`booking-status booking-status-${normalizedStatus} customer-status customer-status-${normalizedStatus}`}
    >
      <span aria-hidden="true" className="booking-status-icon">
        {icon}
      </span>
      <span>{normalizedStatus}</span>
    </span>
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
  triggerRef,
}) {
  return (
    <DialogFrame title={title} onCancel={onCancel} triggerRef={triggerRef}>
      <div className="booking-dialog-copy">{children}</div>
      <div className="booking-dialog-actions">
        <button
          className="booking-button booking-button-outline"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Keep appointment
        </button>
        <button
          className="booking-button booking-button-danger"
          type="button"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy && <span className="booking-spinner" aria-hidden="true" />}
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}

export function DialogFrame({ title, children, onCancel, triggerRef }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    const trigger = triggerRef?.current;
    previousFocus.current = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => {
      (trigger || previousFocus.current)?.focus?.();
    };
  }, [triggerRef]);

  const trapFocus = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...dialogRef.current.querySelectorAll(
        "button:not(:disabled), a[href], input:not(:disabled)",
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="booking-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="booking-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        ref={dialogRef}
        onKeyDown={trapFocus}
      >
        <h2 id="booking-dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function Toast({ message, variant = "success", onDismiss }) {
  if (!message) return null;
  return (
    <div
      className={`booking-toast booking-toast-${variant}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss message" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

export function Skeleton({ count = 3 }) {
  return (
    <div
      className="booking-skeleton-grid"
      role="status"
      aria-label="Loading services"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="booking-skeleton-card" key={index}>
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action, onAction }) {
  return (
    <div className="booking-state booking-empty-state">
      <span className="booking-empty-mark" aria-hidden="true">
        ✳
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action && (
        <button
          className="booking-button booking-button-outline"
          type="button"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}
