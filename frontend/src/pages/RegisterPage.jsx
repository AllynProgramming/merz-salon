import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import Alert from "../components/auth/Alert.jsx";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import Button from "../components/auth/Button.jsx";
import FormField from "../components/auth/FormField.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import PasswordStrength from "../components/auth/PasswordStrength.jsx";
import { getDashboardPath } from "../utils/accountRole.js";

function validate(values, acceptedTerms) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter your full name.";
  else if (values.name.trim().length < 2)
    errors.name = "Your name must be at least 2 characters.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Enter a valid email address.";
  if (!values.phone.trim()) errors.phone = "Enter your phone number.";
  else if (values.phone.trim().length < 7)
    errors.phone = "Enter a valid phone number.";
  if (values.password.length < 8)
    errors.password = "Use at least 8 characters for your password.";
  else if (!/[a-z]/i.test(values.password))
    errors.password = "Add at least one letter to your password.";
  else if (!/\d/.test(values.password))
    errors.password = "Add at least one number to your password.";
  if (!values.confirmPassword)
    errors.confirmPassword = "Confirm your password.";
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = "Your passwords do not match.";
  if (!acceptedTerms)
    errors.terms = "Please agree to the terms and privacy policy to continue.";
  return errors;
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const errors = validate(values, acceptedTerms);

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
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      terms: true,
    });
    const nextErrors = validate(values, acceptedTerms);
    if (Object.keys(nextErrors).length) {
      document
        .getElementById(`register-${Object.keys(nextErrors)[0]}`)
        ?.focus();
      return;
    }

    setLoading(true);
    setServerError("");
    try {
      const user = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
      });
      navigate(getDashboardPath(user?.role) || "/", { replace: true });
    } catch (error) {
      const phoneRequired =
        !values.phone.trim() && error.message === "Enter your phone number";
      setServerError(
        phoneRequired
          ? "The connected registration service currently requires a phone number."
          : error.message ||
              "We could not create your account. Check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="register">
      <p className="auth-eyebrow">A little time for you</p>
      <h1 className="auth-heading">Create your account</h1>
      <p className="auth-intro">
        Save your details and keep every appointment in one place.
      </p>
      <Alert>{serverError}</Alert>
      <Alert variant="success">{success}</Alert>

      <form
        className="auth-form auth-register-form"
        onSubmit={submit}
        noValidate
      >
        <FormField
          id="register-name"
          label="Full name"
          error={touched.name ? errors.name : ""}
          required
        >
          {(fieldProps) => (
            <input
              {...fieldProps}
              className="auth-input"
              type="text"
              name="name"
              value={values.name}
              onChange={update}
              onBlur={() => blur("name")}
              autoComplete="name"
              required
            />
          )}
        </FormField>

        <FormField
          id="register-email"
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

        <FormField
          id="register-phone"
          label="Phone number"
          required
          error={touched.phone ? errors.phone : ""}
        >
          {(fieldProps) => (
            <input
              {...fieldProps}
              className="auth-input"
              type="tel"
              name="phone"
              value={values.phone}
              onChange={update}
              onBlur={() => blur("phone")}
              autoComplete="tel"
              inputMode="tel"
              required
            />
          )}
        </FormField>

        <div className="auth-password-field">
          <PasswordInput
            id="register-password"
            label="Password"
            value={values.password}
            onChange={update}
            onBlur={() => blur("password")}
            autoComplete="new-password"
            error={touched.password ? errors.password : ""}
          />
          <PasswordStrength value={values.password} />
        </div>

        <PasswordInput
          id="register-confirmPassword"
          label="Confirm password"
          value={values.confirmPassword}
          onChange={update}
          onBlur={() => blur("confirmPassword")}
          autoComplete="new-password"
          error={touched.confirmPassword ? errors.confirmPassword : ""}
        />

        <div className="auth-terms-field">
          <label className="auth-check-label" htmlFor="register-terms">
            <input
              id="register-terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              onBlur={() => blur("terms")}
              aria-invalid={Boolean(touched.terms && errors.terms)}
              aria-describedby={
                touched.terms && errors.terms
                  ? "register-terms-error"
                  : undefined
              }
              required
            />
            <span>I agree to the terms and privacy policy.</span>
          </label>
          {touched.terms && errors.terms && (
            <p className="auth-field-error" id="register-terms-error">
              {errors.terms}
            </p>
          )}
        </div>

        <Button
          type="submit"
          loading={loading}
          loadingText="Creating account..."
        >
          Create Account
        </Button>
      </form>

      {success && (
        <Link className="auth-continue-link" to="/">
          Continue to the salon
        </Link>
      )}
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}

export default RegisterPage;
