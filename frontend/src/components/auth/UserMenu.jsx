import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth.js";

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

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
      navigate("/login", {
        replace: true,
        state: { notice: "You've been logged out." },
      });
      setLoggingOut(false);
    }
  };

  return (
    <div className="salon-user-menu" onKeyDown={handleMenuKeyDown}>
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
