import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "../components/landing/Navbar.jsx";
import Modal from "../components/ui/Modal.jsx";
import useConfirm from "../components/ui/useConfirm.jsx";
import { toast } from "../components/ui/toast.js";
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

const emptyPasswords = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  // Which modal is open: "", "profile" or "password".
  const [openModal, setOpenModal] = useState("");
  const [draft, setDraft] = useState(() => toDraft(user));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileTouched, setProfileTouched] = useState({});
  const [passwordValues, setPasswordValues] = useState(emptyPasswords);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordTouched, setPasswordTouched] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const profileChanged = JSON.stringify(draft) !== JSON.stringify(toDraft(user));
  const passwordTyped = Object.values(passwordValues).some(Boolean);
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
  };

  const updatePassword = (event) => {
    setPasswordValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setPasswordError("");
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

  const openProfile = () => {
    setDraft(toDraft(user));
    setProfileErrors({});
    setProfileTouched({});
    setServerError("");
    setOpenModal("profile");
  };

  const openPassword = () => {
    setPasswordValues(emptyPasswords);
    setPasswordErrors({});
    setPasswordTouched({});
    setPasswordError("");
    setOpenModal("password");
  };

  // Escape, the X, a backdrop click and Cancel all land here.
  const closeModal = async () => {
    if (savingProfile || savingPassword) return;
    const unsaved =
      openModal === "profile" ? profileChanged : passwordTyped;
    if (
      unsaved &&
      !(await confirm({
        title: "Discard your changes?",
        description:
          openModal === "profile"
            ? "Your profile changes haven't been saved."
            : "The password you typed hasn't been saved.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Keep Editing",
        tone: "danger",
      }))
    ) {
      return;
    }
    setOpenModal("");
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
      setImageFailed(false);
      setOpenModal("");
      toast.success("Your profile has been saved.");
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
      setPasswordValues(emptyPasswords);
      setOpenModal("");
      toast.success(result.message || "Your password has been changed.");
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
      <main
        id="main-content"
        tabIndex={-1}
        className="customer-container customer-profile-page"
      >
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Your account</p>
            <h1>Profile</h1>
            <p className="customer-lede">
              Keep your contact details current for a smoother visit.
            </p>
          </div>
          <button
            className="customer-button customer-button-primary"
            type="button"
            onClick={openProfile}
          >
            Edit Profile
          </button>
        </header>

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
                width="88"
                height="88"
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
              <dd translate="no">{user?.email || "Not provided"}</dd>
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

        <section
          className="customer-panel customer-security-card"
          aria-labelledby="password-title"
        >
          <div>
            <p className="customer-eyebrow">Account security</p>
            <h2 id="password-title">Password</h2>
            <p className="customer-muted-copy">
              Use a strong password you don’t use anywhere else.
            </p>
          </div>
          <button
            className="customer-button customer-button-outline"
            type="button"
            onClick={openPassword}
          >
            Change Password
          </button>
        </section>
      </main>

      {openModal === "profile" && (
        <Modal onClose={closeModal} size="wide">
          <Modal.Header>
            <div>
              <Modal.Eyebrow>Your account</Modal.Eyebrow>
              <Modal.Title>Edit profile</Modal.Title>
              <Modal.Description>
                Fields marked * are required.
              </Modal.Description>
            </div>
            <Modal.Close label="Close without saving" />
          </Modal.Header>
          <Modal.Body>
            {serverError && (
              <p className="ui-note ui-note--error" role="alert">
                {serverError}
              </p>
            )}
            <form
              id="customer-profile-form"
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
                    data-autofocus
                    required
                  />
                )}
              </CustomerField>
              <CustomerField
                id="customer-email"
                label="Email address"
                helper="Email changes aren’t available right now."
              >
                {(props) => (
                  <input
                    {...props}
                    className="customer-input customer-readonly"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    autoComplete="email"
                    spellCheck={false}
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
                    placeholder="e.g. 0917 123 4567…"
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
                    placeholder="https://…"
                    spellCheck={false}
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
            </form>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="customer-button customer-button-outline"
              type="button"
              onClick={closeModal}
              disabled={savingProfile}
            >
              Cancel
            </button>
            <button
              className="customer-button customer-button-primary"
              type="submit"
              form="customer-profile-form"
              disabled={savingProfile}
            >
              {savingProfile ? (
                <>
                  <span className="ui-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {openModal === "password" && (
        <Modal onClose={closeModal}>
          <Modal.Header>
            <div>
              <Modal.Eyebrow>Account security</Modal.Eyebrow>
              <Modal.Title>Change password</Modal.Title>
              <Modal.Description>
                Use at least 8 characters with a letter and a number.
              </Modal.Description>
            </div>
            <Modal.Close label="Close without changing" />
          </Modal.Header>
          <Modal.Body>
            {passwordError && (
              <p className="ui-note ui-note--error" role="alert">
                {passwordError}
              </p>
            )}
            <form
              id="customer-password-form"
              className="customer-password-form customer-password-form--stacked"
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
            </form>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="customer-button customer-button-outline"
              type="button"
              onClick={closeModal}
              disabled={savingPassword}
            >
              Cancel
            </button>
            <button
              className="customer-button customer-button-primary"
              type="submit"
              form="customer-password-form"
              disabled={savingPassword}
            >
              {savingPassword ? (
                <>
                  <span className="ui-spinner" aria-hidden="true" />
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </Modal.Footer>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

export default ProfilePage;
