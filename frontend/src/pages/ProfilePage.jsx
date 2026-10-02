import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useBlocker } from "react-router-dom";
import Navbar from "../components/landing/Navbar.jsx";
import {
  CustomerField,
  CustomerPasswordField,
} from "../components/customer/CustomerFields.jsx";
import PasswordStrength from "../components/auth/PasswordStrength.jsx";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";

function toDraft(user) {
  return {
    name:
      user?.name || [user?.firstname, user?.lastname].filter(Boolean).join(" "),
    phone: user?.phone || user?.phoneNumber || "",
    address: user?.address || "",
    dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "",
    avatarUrl: user?.avatarUrl || "",
  };
}

function validateProfile(values) {
  const errors = {};
  if (values.name.trim().length < 2)
    errors.name = "Enter your name (at least 2 characters).";
  if (values.name.trim().length > 60)
    errors.name = "Your name must be 60 characters or fewer.";
  if (
    !/^\+?[0-9().\s-]{7,30}$/.test(values.phone.trim()) ||
    (values.phone.match(/\d/g) || []).length < 7
  )
    errors.phone = "Enter a valid phone number.";
  if (values.address.length > 200)
    errors.address = "Address must be 200 characters or fewer.";
  if (
    values.dateOfBirth &&
    values.dateOfBirth > new Date().toISOString().slice(0, 10)
  )
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (values.avatarUrl) {
    try {
      const url = new URL(values.avatarUrl);
      if (!["http:", "https:"].includes(url.protocol))
        errors.avatarUrl = "Use an HTTP or HTTPS image URL.";
    } catch {
      errors.avatarUrl = "Enter a valid image URL.";
    }
  }
  return errors;
}

function validatePassword(values) {
  const errors = {};
  if (!values.currentPassword)
    errors.currentPassword = "Enter your current password.";
  if (values.newPassword.length < 8)
    errors.newPassword = "Use at least 8 characters.";
  else if (!/[a-z]/i.test(values.newPassword))
    errors.newPassword = "Add at least one letter.";
  else if (!/\d/.test(values.newPassword))
    errors.newPassword = "Add at least one number.";
  if (!values.confirmPassword)
    errors.confirmPassword = "Confirm your new password.";
  else if (values.confirmPassword !== values.newPassword)
    errors.confirmPassword = "Passwords do not match.";
  return errors;
}

function memberSince(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
  }).format(new Date(value));
}

function formatBirthday(value) {
  if (!value) return "Not provided";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(user));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileTouched, setProfileTouched] = useState({});
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordTouched, setPasswordTouched] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  const changed = JSON.stringify(draft) !== JSON.stringify(toDraft(user));
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      editing && changed && currentLocation.pathname !== nextLocation.pathname,
  );
  const { state: navigationState, proceed, reset } = blocker;
  const fullName =
    user?.name ||
    [user?.firstname, user?.lastname].filter(Boolean).join(" ") ||
    "Customer";

  const updateDraft = (event) => {
    setDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setServerError("");
    setNotice("");
  };

  const updatePassword = (event) => {
    setPasswordValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setPasswordError("");
    setPasswordNotice("");
  };

  const touchProfile = (field) => {
    setProfileTouched((current) => ({ ...current, [field]: true }));
    setProfileErrors((current) => ({
      ...current,
      [field]: validateProfile(draft)[field] || "",
    }));
  };

  const touchPassword = (field) => {
    setPasswordTouched((current) => ({ ...current, [field]: true }));
    setPasswordErrors((current) => ({
      ...current,
      [field]: validatePassword(passwordValues)[field] || "",
    }));
  };

  useEffect(() => {
    if (navigationState !== "blocked") return;
    if (window.confirm("Discard your unsaved profile changes?")) {
      proceed();
    } else {
      reset();
    }
  }, [navigationState, proceed, reset]);

  const cancelEdit = () => {
    if (changed && !window.confirm("Discard your unsaved profile changes?"))
      return;
    setDraft(toDraft(user));
    setProfileErrors({});
    setProfileTouched({});
    setServerError("");
    setEditing(false);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const errors = validateProfile(draft);
    setProfileTouched({
      name: true,
      phone: true,
      address: true,
      dateOfBirth: true,
      avatarUrl: true,
    });
    setProfileErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(`customer-${Object.keys(errors)[0]}`)?.focus();
      return;
    }

    setSavingProfile(true);
    setServerError("");
    try {
      await updateProfile({
        ...draft,
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
      });
      setNotice("Your profile has been saved.");
      setEditing(false);
      setProfileTouched({});
    } catch (error) {
      setServerError(error.message || "We couldn't save your profile.");
      if (error.errors) setProfileErrors(error.errors);
      const firstField = Object.keys(error.errors || {})[0];
      if (firstField)
        document.getElementById(`customer-${firstField}`)?.focus();
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const errors = validatePassword(passwordValues);
    setPasswordTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });
    setPasswordErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(`customer-${Object.keys(errors)[0]}`)?.focus();
      return;
    }

    setSavingPassword(true);
    setPasswordError("");
    try {
      const result = await changePassword(passwordValues);
      setPasswordValues({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordTouched({});
      setPasswordErrors({});
      setPasswordNotice(result.message || "Your password has been changed.");
    } catch (error) {
      setPasswordError(error.message || "We couldn't change your password.");
      if (error.errors) setPasswordErrors(error.errors);
      const firstField = Object.keys(error.errors || {})[0];
      if (firstField)
        document.getElementById(`customer-${firstField}`)?.focus();
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="customer-page salon-landing">
      <Helmet>
        <title>Customer Profile | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main className="customer-container customer-profile-page">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Your account</p>
            <h1>Profile</h1>
            <p className="customer-lede">
              Keep your contact details current for a smoother visit.
            </p>
          </div>
          {!editing && (
            <button
              className="customer-button customer-button-primary"
              type="button"
              onClick={() => {
                setDraft(toDraft(user));
                setEditing(true);
              }}
            >
              Edit Profile
            </button>
          )}
        </header>

        {serverError && (
          <div
            className="customer-alert customer-alert-error"
            role="alert"
            aria-live="assertive"
          >
            {serverError}
          </div>
        )}
        {notice && (
          <div
            className="customer-alert customer-alert-success"
            role="status"
            aria-live="polite"
          >
            {notice}
          </div>
        )}

        {!editing ? (
          <section
            className="customer-profile-card"
            aria-labelledby="profile-card-title"
          >
            <div className="customer-profile-summary">
              {user?.avatarUrl && !imageFailed ? (
                <img
                  className="customer-profile-avatar"
                  src={user.avatarUrl}
                  alt={`${fullName} profile`}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div
                  className="customer-profile-avatar customer-profile-initials"
                  role="img"
                  aria-label={`${fullName} initials`}
                >
                  {initialsFor(fullName)}
                </div>
              )}
              <div>
                <p className="customer-eyebrow">Customer profile</p>
                <h2 id="profile-card-title">{fullName}</h2>
                <p>Member since {memberSince(user?.createdAt)}</p>
              </div>
            </div>
            <dl className="customer-profile-details">
              <div>
                <dt>Email</dt>
                <dd>{user?.email || "Not provided"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{user?.phone || user?.phoneNumber || "Not provided"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{user?.address || "Not provided"}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{formatBirthday(user?.dateOfBirth)}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <section
            className="customer-panel"
            aria-labelledby="edit-profile-title"
          >
            <div className="customer-section-title-row">
              <h2 id="edit-profile-title">Edit Profile</h2>
              <span className="customer-required-note">* Required</span>
            </div>
            <form
              className="customer-form-grid"
              onSubmit={saveProfile}
              noValidate
            >
              <CustomerField
                id="customer-name"
                label="Full name"
                required
                error={profileTouched.name ? profileErrors.name : ""}
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={draft.name}
                    onChange={updateDraft}
                    onBlur={() => touchProfile("name")}
                    required
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-email"
                label="Email address"
                helper="Email changes are not available right now."
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input customer-readonly"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    autoComplete="email"
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-phone"
                label="Phone number"
                required
                error={profileTouched.phone ? profileErrors.phone : ""}
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input"
                    type="tel"
                    name="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={updateDraft}
                    onBlur={() => touchProfile("phone")}
                    required
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-dateOfBirth"
                label="Date of birth"
                error={
                  profileTouched.dateOfBirth ? profileErrors.dateOfBirth : ""
                }
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input"
                    type="date"
                    name="dateOfBirth"
                    autoComplete="bday"
                    max={new Date().toISOString().slice(0, 10)}
                    value={draft.dateOfBirth}
                    onChange={updateDraft}
                    onBlur={() => touchProfile("dateOfBirth")}
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-address"
                label="Address"
                helper="Optional, up to 200 characters."
                error={profileTouched.address ? profileErrors.address : ""}
              >
                {(props) => (
                  <textarea
                    {...props}
                    className="customer-input customer-textarea"
                    name="address"
                    autoComplete="street-address"
                    maxLength={200}
                    value={draft.address}
                    onChange={updateDraft}
                    onBlur={() =>
                      setProfileTouched((current) => ({
                        ...current,
                        address: true,
                      }))
                    }
                    rows={3}
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-avatarUrl"
                label="Profile image URL"
                helper="Optional. Use a public HTTP or HTTPS image URL."
                error={profileTouched.avatarUrl ? profileErrors.avatarUrl : ""}
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input"
                    type="url"
                    name="avatarUrl"
                    autoComplete="url"
                    value={draft.avatarUrl}
                    onChange={updateDraft}
                    onBlur={() =>
                      setProfileTouched((current) => ({
                        ...current,
                        avatarUrl: true,
                      }))
                    }
                  />
                )}
              </CustomerField>
              <div className="customer-form-actions">
                <button
                  className="customer-button customer-button-primary"
                  type="submit"
                  disabled={savingProfile}
                >
                  {savingProfile && (
                    <span className="customer-spinner" aria-hidden="true" />
                  )}{" "}
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="customer-button customer-button-outline"
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section
          className="customer-panel customer-password-panel"
          aria-labelledby="password-title"
        >
          <div>
            <p className="customer-eyebrow">Account security</p>
            <h2 id="password-title">Change Password</h2>
            <p className="customer-muted-copy">
              Choose a strong password you do not use elsewhere.
            </p>
          </div>
          {passwordError && (
            <div
              className="customer-alert customer-alert-error"
              role="alert"
              aria-live="assertive"
            >
              {passwordError}
            </div>
          )}
          {passwordNotice && (
            <div
              className="customer-alert customer-alert-success"
              role="status"
              aria-live="polite"
            >
              {passwordNotice}
            </div>
          )}
          <form
            className="customer-password-form"
            onSubmit={submitPassword}
            noValidate
          >
            <CustomerPasswordField
              id="customer-currentPassword"
              label="Current password"
              value={passwordValues.currentPassword}
              onChange={updatePassword}
              onBlur={() => touchPassword("currentPassword")}
              autoComplete="current-password"
              error={
                passwordTouched.currentPassword
                  ? passwordErrors.currentPassword
                  : ""
              }
            />
            <div>
              <CustomerPasswordField
                id="customer-newPassword"
                label="New password"
                value={passwordValues.newPassword}
                onChange={updatePassword}
                onBlur={() => touchPassword("newPassword")}
                autoComplete="new-password"
                error={
                  passwordTouched.newPassword ? passwordErrors.newPassword : ""
                }
              />
              <PasswordStrength value={passwordValues.newPassword} />
            </div>
            <CustomerPasswordField
              id="customer-confirmPassword"
              label="Confirm new password"
              value={passwordValues.confirmPassword}
              onChange={updatePassword}
              onBlur={() => touchPassword("confirmPassword")}
              autoComplete="new-password"
              error={
                passwordTouched.confirmPassword
                  ? passwordErrors.confirmPassword
                  : ""
              }
            />
            <div className="customer-form-actions">
              <button
                className="customer-button customer-button-primary"
                type="submit"
                disabled={savingPassword}
              >
                {savingPassword && (
                  <span className="customer-spinner" aria-hidden="true" />
                )}{" "}
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;
