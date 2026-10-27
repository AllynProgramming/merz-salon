import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import Alert from "../components/auth/Alert.jsx";
import Button from "../components/auth/Button.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import useAuth from "../context/useAuth.js";

function StaffChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (event) => {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (values.newPassword.length < 8 || !/[a-z]/i.test(values.newPassword) || !/\d/.test(values.newPassword)) {
      setError("Use at least 8 characters, including one letter and one number.");
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setError("Your new passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await changePassword(values);
      navigate("/staff", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Could not update your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="login">
      <Helmet>
        <title>Set your staff password | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <p className="auth-eyebrow">One quick security step</p>
      <h1 className="auth-heading">Set your password</h1>
      <p className="auth-intro">
        Your administrator gave you a temporary password. Replace it now with
        one only you know.
      </p>
      <Alert>{error}</Alert>
      <form className="auth-form" onSubmit={submit}>
        <PasswordInput
          id="staff-current-password"
          label="Temporary password"
          name="currentPassword"
          value={values.currentPassword}
          onChange={update}
          autoComplete="current-password"
        />
        <PasswordInput
          id="staff-new-password"
          label="New password"
          name="newPassword"
          value={values.newPassword}
          onChange={update}
          autoComplete="new-password"
        />
        <PasswordInput
          id="staff-confirm-password"
          label="Confirm new password"
          name="confirmPassword"
          value={values.confirmPassword}
          onChange={update}
          autoComplete="new-password"
        />
        <Button type="submit" loading={loading} loadingText="Saving password...">
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}

export default StaffChangePasswordPage;
