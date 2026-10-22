import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth.js";

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Could not load notifications.");
  }
  return payload;
}

function StaffNotificationBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [notificationResponse, countResponse] = await Promise.all([
        fetch("/api/notifications?limit=5", { headers }),
        fetch("/api/notifications/unread-count", { headers }),
      ]);
      const [notificationData, countData] = await Promise.all([
        readJson(notificationResponse),
        readJson(countResponse),
      ]);

      setNotifications(notificationData.items || []);
      setUnreadCount(Number(countData.unreadCount || 0));
    } catch (requestError) {
      setError(requestError.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialLoadId = window.setTimeout(loadNotifications, 0);
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const openNotification = async (notification) => {
    if (!notification?._id || busyId) return;
    setBusyId(notification._id);
    setError("");
    try {
      if (!notification.isRead) {
        await readJson(
          await fetch(`/api/notifications/${notification._id}/read`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
      }
      await loadNotifications();
      setOpen(false);
      navigate("/admin/schedule");
    } catch (requestError) {
      setError(requestError.message || "Could not open this notification.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="staff-notification">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={
          unreadCount
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        className="customer-button customer-button-outline staff-notification__trigger"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) loadNotifications();
        }}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="staff-notification__count" aria-live="polite">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          aria-label="Staff notifications"
          className="staff-notification__panel"
        >
          <div className="staff-notification__header">
            <strong>Notifications</strong>
            <span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
          </div>
          {error ? (
            <div className="staff-notification__message" role="alert">
              <p>{error}</p>
              <button type="button" onClick={loadNotifications}>
                Try again
              </button>
            </div>
          ) : loading && notifications.length === 0 ? (
            <p className="staff-notification__message" role="status">
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <p className="staff-notification__message">
              Appointment assignments and updates will appear here.
            </p>
          ) : (
            <ul className="staff-notification__list">
              {notifications.map((notification) => (
                <li key={notification._id}>
                  <button
                    className={
                      notification.isRead
                        ? "staff-notification__item"
                        : "staff-notification__item is-unread"
                    }
                    disabled={busyId === notification._id}
                    onClick={() => openNotification(notification)}
                    type="button"
                  >
                    <strong>
                      {notification.title || "Appointment update"}
                    </strong>
                    <span>{notification.message}</span>
                    <time dateTime={notification.createdAt}>
                      {new Date(notification.createdAt).toLocaleString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="staff-notification__schedule-link"
            onClick={() => {
              setOpen(false);
              navigate("/admin/schedule");
            }}
            type="button"
          >
            View schedule
          </button>
        </section>
      )}
    </div>
  );
}

export default StaffNotificationBell;
