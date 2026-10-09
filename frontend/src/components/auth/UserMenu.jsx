import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth.js";

function UserMenu() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const fullName =
    user?.name ||
    [user?.firstname, user?.lastname].filter(Boolean).join(" ") ||
    "Customer";
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const loadNotifications = async () => {
    if (!token) return;

    setLoadingNotifications(true);
    try {
      const [notificationResponse, countResponse] = await Promise.all([
        fetch("/api/notifications?limit=5", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/notifications/unread-count", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const notificationData = await notificationResponse
        .json()
        .catch(() => ({}));
      const countData = await countResponse.json().catch(() => ({}));

      setNotifications(notificationData.items || []);
      setUnreadCount(Number(countData.unreadCount ?? countData.count ?? 0));
    } catch (error) {
      console.error("Could not load notifications.", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (token) {
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsOpen(false);
    }
  }, [token]);

  const handleMenuKeyDown = (event) => {
    const items = itemRefs.current.filter(Boolean);
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // The context clears the local token even if the logout request is offline.
    } finally {
      setOpen(false);
      setNotificationsOpen(false);
      navigate("/login", {
        replace: true,
        state: { notice: "You've been logged out." },
      });
      setLoggingOut(false);
    }
  };

  const handleNotificationToggle = async () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) {
      await loadNotifications();
    }
  };

  const markNotificationRead = async (notificationId) => {
    if (!token || !notificationId) return;

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await loadNotifications();
    } catch (error) {
      console.error("Could not mark notification as read.", error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!token) return;

    try {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await loadNotifications();
    } catch (error) {
      console.error("Could not clear notifications.", error);
    }
  };

  return (
    <div className="salon-user-menu" onKeyDown={handleMenuKeyDown}>
      <div className="salon-top-actions">
        <div className="salon-notification-menu">
          <button
            className="salon-notification-button"
            type="button"
            aria-label={`${unreadCount} unread notifications`}
            aria-expanded={notificationsOpen}
            onClick={handleNotificationToggle}
          >
            <svg
              className="salon-notification-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M8.5 15.5V10a3.5 3.5 0 1 1 7 0v5.5l1.5 2.5H7l1.5-2.5Zm3.5 5.5a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" />
            </svg>
            {unreadCount > 0 && (
              <span className="salon-notification-badge" aria-live="polite">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="salon-notification-dropdown"
              role="menu"
              aria-label="Notifications"
            >
              <div className="salon-notification-header">
                <strong>Notifications</strong>
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllNotificationsRead}>
                    Mark all read
                  </button>
                ) : (
                  <span>All caught up</span>
                )}
              </div>

              {loadingNotifications ? (
                <p className="salon-notification-empty">Loading reminders...</p>
              ) : notifications.length === 0 ? (
                <p className="salon-notification-empty">
                  No notifications yet. Your appointment reminders will appear
                  here.
                </p>
              ) : (
                <ul className="salon-notification-list">
                  {notifications.map((notification) => (
                    <li
                      key={notification._id}
                      className={notification.isRead ? "is-read" : "is-unread"}
                    >
                      <button
                        className="salon-notification-item"
                        type="button"
                        onClick={() => markNotificationRead(notification._id)}
                      >
                        <span className="salon-notification-title">
                          {notification.title || "Appointment update"}
                        </span>
                        <span className="salon-notification-message">
                          {notification.message}
                        </span>
                        <span className="salon-notification-time">
                          {new Date(notification.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          className="salon-user-trigger"
          type="button"
          ref={triggerRef}
          aria-label={`Account menu for ${fullName}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="salon-user-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="salon-user-name">{fullName}</span>
          <span className="salon-user-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
      </div>

      {open && (
        <div className="salon-user-dropdown" role="menu" aria-label="Account">
          <NavLink
            className={({ isActive }) => (isActive ? "is-active" : "")}
            ref={(node) => {
              itemRefs.current[0] = node;
            }}
            to="/dashboard"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          >
            Dashboard
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? "is-active" : "")}
            ref={(node) => {
              itemRefs.current[1] = node;
            }}
            to="/appointments"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          >
            My Appointments
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? "is-active" : "")}
            ref={(node) => {
              itemRefs.current[2] = node;
            }}
            to="/profile"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          >
            Profile
          </NavLink>
          <button
            ref={(node) => {
              itemRefs.current[3] = node;
            }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
