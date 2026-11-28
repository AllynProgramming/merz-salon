import { Link } from "react-router-dom";
import {
  formatDate,
  formatDuration,
  formatPrice,
  formatTime,
  isMostLoved,
} from "./bookingUtils.js";

const ratingFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function ServiceDuration({ minutes }) {
  return (
    <span className="booking-service-duration">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6v4.2l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {formatDuration(minutes)}
    </span>
  );
}

export function ServiceRating({ service }) {
  const rating = Number(service?.averageRating ?? 0);
  const count = Number(service?.ratingCount ?? 0);
  if (!(rating > 0 && count > 0)) {
    return <span className="booking-service-rating is-empty">New</span>;
  }
  return (
    <span className="booking-service-rating">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <path
          d="M10 2.2l2.3 4.9 5.3.6-3.9 3.6 1 5.3L10 14l-4.7 2.6 1-5.3-3.9-3.6 5.3-.6z"
          fill="currentColor"
        />
      </svg>
      <span>
        <strong>{ratingFormat.format(rating)}</strong>{" "}
        <small>
          ({count} review{count === 1 ? "" : "s"})
        </small>
      </span>
    </span>
  );
}

/**
 * One service on the menu. The name opens the details pop-up; "Book" goes
 * straight to booking with the service already chosen.
 */
export function ServiceCard({ service, onShowDetails }) {
  return (
    <article className="booking-service-card">
      <div className="booking-service-topline">
        <span className="booking-category-label">
          {service.category || "Service"}
        </span>
        {isMostLoved(service) && (
          <span className="booking-service-badge">Most loved</span>
        )}
      </div>
      <h3>
        <button
          type="button"
          className="booking-service-name"
          onClick={() => onShowDetails?.(service)}
          aria-haspopup="dialog"
        >
          {service.name}
        </button>
      </h3>
      {service.description && (
        <p className="booking-service-description">{service.description}</p>
      )}
      <div className="booking-service-facts">
        <ServiceDuration minutes={service.durationMinutes} />
        <ServiceRating service={service} />
      </div>
      <div className="booking-service-footer">
        <strong className="booking-service-price">
          {formatPrice(service.price)}
        </strong>
        <Link
          className="booking-service-book"
          to={`/book-appointment?service=${encodeURIComponent(service._id)}`}
          aria-label={`Book ${service.name}`}
        >
          Book
        </Link>
      </div>
    </article>
  );
}

export function ServiceFilters({
  categories,
  counts,
  category,
  onCategory,
  search,
  onSearch,
  sort,
  onSort,
}) {
  return (
    <div className={`booking-filters${onSort ? "" : " booking-filters--no-sort"}`}>
      <label className="booking-search-field">
        <span className="booking-visually-hidden">Search services</span>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          name="service-search"
          placeholder="Search haircut, color, nails…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {onSort && (
        <label className="booking-sort-field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => onSort(event.target.value)}>
            <option value="name">Name</option>
            <option value="popular">Most popular</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="duration">Shortest first</option>
          </select>
        </label>
      )}
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
            {counts && <span className="booking-filter-count">{counts[item] ?? 0}</span>}
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
          <i className="is-unavailable" /> No staff available
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
    "expired",
  ].includes(status)
    ? status
    : "pending";
  const icon = {
    pending: "◷",
    confirmed: "✓",
    completed: "✓",
    cancelled: "×",
    expired: "!",
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
