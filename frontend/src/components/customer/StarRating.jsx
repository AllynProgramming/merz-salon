import { useRef, useState } from "react";

function StarRating({
  value = 0,
  onChange,
  interactive = false,
  disabled = false,
}) {
  const [preview, setPreview] = useState(null);
  const groupRef = useRef(null);
  const displayedValue = preview ?? Number(value);

  if (!interactive) {
    const rating = Number(value) || 0;
    return (
      <span
        className="customer-star-display"
        role="img"
        aria-label={`${rating.toFixed(1)} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const difference = rating - index;
          const className =
            difference >= 0.75
              ? "is-full"
              : difference >= 0.25
                ? "is-half"
                : "is-empty";
          return (
            <span className={className} key={index} aria-hidden="true">
              ★
            </span>
          );
        })}
      </span>
    );
  }

  const selectRating = (rating) => {
    onChange?.(rating);
    setPreview(rating);
  };

  const handleKeyDown = (event, rating) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextRating =
      event.key === "Home"
        ? 1
        : event.key === "End"
          ? 5
          : Math.min(5, Math.max(1, rating + direction));
    selectRating(nextRating);
    groupRef.current?.querySelector(`[data-rating="${nextRating}"]`)?.focus();
  };

  return (
    <div
      className="customer-rating-picker"
      role="radiogroup"
      aria-label={`${displayedValue || 0} out of 5 stars`}
      ref={groupRef}
      onMouseLeave={() => setPreview(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const rating = index + 1;
        const selected = displayedValue >= rating;
        return (
          <button
            aria-label={`${rating} out of 5 stars`}
            aria-checked={value === rating}
            className={selected ? "is-selected" : ""}
            data-rating={rating}
            disabled={disabled}
            key={rating}
            onClick={() => selectRating(rating)}
            onFocus={() => setPreview(rating)}
            onKeyDown={(event) => handleKeyDown(event, rating)}
            onMouseEnter={() => setPreview(rating)}
            role="radio"
            tabIndex={
              value === rating || (value === 0 && rating === 1) ? 0 : -1
            }
            type="button"
          >
            {selected ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}

export default StarRating;
