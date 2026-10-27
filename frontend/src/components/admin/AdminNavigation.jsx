import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth.js";
import { getDashboardPath } from "../../utils/accountRole.js";

const adminItems = [
  { to: "/admin", label: "Overview", section: "Today" },
  { to: "/staff/book-appointment", label: "Book appointment", section: "Today" },
  { to: "/admin/schedule", label: "Schedule", section: "Manage" },
  { to: "/admin/services", label: "Services", section: "Manage" },
  { to: "/admin/staff", label: "Staff", section: "Manage", adminOnly: true },
  { to: "/admin/feedback", label: "Feedback", section: "Insights", adminOnly: true },
  { to: "/admin/reports", label: "Reports", section: "Insights", adminOnly: true },
];

function isCurrentRoute(pathname, target) {
  return target === "/admin"
    ? pathname === "/admin" || pathname === "/staff"
    : pathname === target || pathname.startsWith(`${target}/`);
}

function AdminNavigation() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const dashboardPath = getDashboardPath(user?.role) || "/";
  const items = adminItems
    .filter((item) => !item.adminOnly || isAdmin)
    .map((item) =>
      item.to === "/admin" && !isAdmin ? { ...item, to: "/staff" } : item,
    );

  const handleLogout = async () => {
    await logout();
    navigate("/login", {
      replace: true,
      state: { notice: "You've been logged out." },
    });
  };

  return (
    <aside className="admin-navigation" aria-label="Salon administration">
      <div className="admin-navigation__brand">
        <Link to={dashboardPath} aria-label="MERZ administration home">
          <img src="/logo-mark.png" alt="" />
          <span>MERZ <small>control room</small></span>
        </Link>
      </div>
      <nav className="admin-navigation__links">
        {["Today", "Manage", "Insights"].map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (!sectionItems.length) return null;
          return (
            <div className="admin-navigation__group" key={section}>
              <p>{section}</p>
              {sectionItems.map((item) => {
                const active = isCurrentRoute(location.pathname, item.to);
                return (
                  <Link
                    className={active ? "is-active" : ""}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    key={item.to}
                  >
                    <span className="admin-navigation__marker" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="admin-navigation__footer">
        {isAdmin && (
          <Link
            className={isCurrentRoute(location.pathname, "/admin/settings") ? "is-active" : ""}
            to="/admin/settings"
            aria-current={isCurrentRoute(location.pathname, "/admin/settings") ? "page" : undefined}
          >
            <span className="admin-navigation__marker" aria-hidden="true" />
            Settings
          </Link>
        )}
        <Link to="/" className="admin-navigation__site-link">
          View salon site
        </Link>
        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default AdminNavigation;
