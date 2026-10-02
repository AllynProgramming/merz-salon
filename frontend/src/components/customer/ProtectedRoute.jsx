import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../context/useAuth.js";

function ProtectedRoute() {
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

  return <Outlet />;
}

export default ProtectedRoute;
