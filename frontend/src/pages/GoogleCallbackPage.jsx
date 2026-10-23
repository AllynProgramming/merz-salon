import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../context/useAuth.js";

function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      loginWithToken(token)
        .then(() => navigate("/dashboard", { replace: true }))
        .catch(() => navigate("/login?google_error=invalid_session", { replace: true }));
      return;
    }
    navigate("/login?google_error=missing_token", { replace: true });
  }, [loginWithToken, navigate, params]);

  return <main className="customer-route-loading"><p role="status">Signing you in…</p></main>;
}

export default GoogleCallbackPage;
