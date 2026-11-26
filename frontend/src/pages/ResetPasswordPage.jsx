import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Alert from "../components/auth/Alert.jsx";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import Button from "../components/auth/Button.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import PasswordStrength from "../components/auth/PasswordStrength.jsx";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...values }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Could not reset your password.");
      setNotice(payload.message);
      setValues({ password: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="reset-password">
      <p className="auth-eyebrow">Account recovery</p>
      <h1 className="auth-heading">Choose a new password</h1>
      <p className="auth-intro">Use a password you do not use elsewhere.</p>
      <Alert>{error}</Alert>
      <Alert variant="success">{notice}</Alert>
      {!token ? (
        <Alert>The password reset link is missing or invalid.</Alert>
      ) : !notice ? (
        <form className="auth-form" onSubmit={submit} noValidate>
          <PasswordInput
            id="reset-password"
            name="password"
            label="New password"
            value={values.password}
            onChange={update}
            autoComplete="new-password"
          />
          <PasswordStrength value={values.password} />
          <PasswordInput
            id="reset-confirm-password"
            name="confirmPassword"
            label="Confirm new password"
            value={values.confirmPassword}
            onChange={update}
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} loadingText="Resetting...">
            Reset password
          </Button>
        </form>
      ) : null}
      <p className="auth-switch">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
