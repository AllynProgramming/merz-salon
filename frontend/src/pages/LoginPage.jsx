import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import Alert from "../components/auth/Alert.jsx";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import Button from "../components/auth/Button.jsx";
import FormField from "../components/auth/FormField.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import { getDashboardPath } from "../utils/accountRole.js";

function validate(values) {
  const errors = {};
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Enter your password.";
  return errors;
}

function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(location.state?.notice || "");
  const [loading, setLoading] = useState(false);
  const googleError = new URLSearchParams(location.search).get("google_error");
  const googleMessages = {
    disabled: "Google login is currently disabled.",
    customer_only: "Google login is available for customer accounts only.",
    exchange_failed: "Google login could not be completed.",
    profile_failed: "Google did not return a verified customer profile.",
    account_conflict: "This Google account is already linked to another account.",
    server: "Google login could not be completed. Please try again.",
  };
  const errors = validate(values);

  const update = (event) => {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setServerError("");
    setSuccess("");
  };

  const blur = (field) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const submit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`login-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    setLoading(true);
    setServerError("");
    try {
      const user = await login({ email: values.email.trim(), password: values.password });
      const requestedPage = location.state?.from;
      const fallback = getDashboardPath(user?.role) || "/";
      const destination = requestedPage
        ? `${requestedPage.pathname}${requestedPage.search || ""}${requestedPage.hash || ""}`
        : fallback;
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(error.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="login">
      <p className="auth-eyebrow">Welcome back</p>
      <h1 className="auth-heading">Log in to your account</h1>
      <p className="auth-intro">
        Your appointments and schedule are right where you left them.
      </p>
      <Alert>{serverError}</Alert>
      <Alert>{googleMessages[googleError] || ""}</Alert>
      <Alert variant="success">{success}</Alert>
      <button
        className="auth-button auth-button-secondary"
        type="button"
        onClick={() => {
          window.location.href = "/api/auth/google";
        }}
      >
        Continue with Google
      </button>

      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          id="login-email"
          label="Email address"
          error={touched.email ? errors.email : ""}
          required
        >
          {(fieldProps) => (
            <input
              {...fieldProps}
              className="auth-input"
              type="email"
              name="email"
              value={values.email}
              onChange={update}
              onBlur={() => blur("email")}
              autoComplete="email"
              inputMode="email"
              required
            />
          )}
        </FormField>

        <PasswordInput
          id="login-password"
          label="Password"
          value={values.password}
          onChange={update}
          onBlur={() => blur("password")}
          autoComplete="current-password"
          error={touched.password ? errors.password : ""}
        />

        <div className="auth-form-options">
          <label className="auth-check-label">
            <input type="checkbox" name="remember" />
            <span>Remember me</span>
          </label>
          <button
            className="auth-text-link"
            type="button"
            aria-label="Forgot password? This link is not connected yet."
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" loading={loading} loadingText="Logging in...">
          Log In
        </Button>
      </form>

      <p className="auth-switch">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
