import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../context/useAuth.js";
import { getDashboardPath } from "../../utils/accountRole.js";

function ProtectedRoute({ allowedRoles = ["customer"] }) {
  const { user, isRestoring, authNotice } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <main className="customer-route-loading" aria-busy="true">
        <p role="status">Loading your account...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, notice: authNotice }}
      />
    );
  }

  if (
    user.role === "staff" &&
    user.mustChangePassword &&
    location.pathname !== "/staff/change-password"
  ) {
    return <Navigate to="/staff/change-password" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const fallbackPath = getDashboardPath(user.role) || "/";
    return <Navigate to={fallbackPath} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
