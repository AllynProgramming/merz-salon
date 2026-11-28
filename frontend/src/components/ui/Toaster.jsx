import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToToasts } from "./toast.js";
import "./ui.css";

function Toaster() {
  const items = useSyncExternalStore(subscribeToToasts, getToasts);

  return (
    // Always mounted, so screen readers announce toasts as they arrive.
    <div className="ui-toaster" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div
          className={`ui-toast ui-toast--${item.tone}`}
          key={item.id}
        >
          <span className="ui-toast__icon" aria-hidden="true">
            {item.tone === "error" ? "!" : "✓"}
          </span>
          <p>{item.message}</p>
          <button
            type="button"
            className="ui-toast__dismiss"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(item.id)}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
