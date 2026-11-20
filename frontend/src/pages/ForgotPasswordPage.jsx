import { useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/auth/Alert.jsx";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import Button from "../components/auth/Button.jsx";
import FormField from "../components/auth/FormField.jsx";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Could not send the reset link.");
      setNotice(payload.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="forgot-password">
      <p className="auth-eyebrow">Account recovery</p>
      <h1 className="auth-heading">Reset your password</h1>
      <p className="auth-intro">
        Enter your email and we’ll send a secure link if an account is found.
      </p>
      <Alert>{error}</Alert>
      <Alert variant="success">{notice}</Alert>
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField id="forgot-email" label="Email address" required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              className="auth-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          )}
        </FormField>
        <Button type="submit" loading={loading} loadingText="Sending...">
          Send reset link
        </Button>
      </form>
      <p className="auth-switch">
        Remember your password? <Link to="/login">Back to login</Link>
      </p>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
