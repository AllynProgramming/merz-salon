import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import AdminNavigation from "../components/admin/AdminNavigation.jsx";
import Modal from "../components/ui/Modal.jsx";
import useConfirm from "../components/ui/useConfirm.jsx";
import { toast } from "../components/ui/toast.js";

const initialSettings = {
  emailNotifications: true,
  appointmentReminders: true,
  googleCalendar: false,
  googleDrive: false,
  pdfReports: true,
  googleLogin: false,
  embeddedMaps: true,
  recaptchaRequired: false,
  calendarConnected: false,
  calendarEmail: "",
  driveConnected: false,
  driveEmail: "",
};

const calendarErrorMessages = {
  authorization_denied:
    "Google Calendar connection was cancelled or denied. Please try again and allow calendar access.",
  redirect_uri_mismatch:
    "Google rejected the callback address. Check that the Google OAuth redirect URI is exactly http://localhost:3000/api/v1/admin/calendar/callback.",
  refresh_token_missing:
    "Google did not return a refresh token. Reconnect and approve calendar access again.",
  oauth_credentials_rejected:
    "Google rejected the OAuth credentials. Verify the client ID, client secret, and callback URI in the backend configuration.",
  timezone_update_failed:
    "Google Calendar connected, but its timezone could not be set to the salon timezone. Set the calendar timezone to Asia/Manila and reconnect.",
  connection_failed:
    "Google Calendar could not be connected. Check the backend logs for the provider error, then try again.",
};

const initialCalendarError = () => {
  const errorCode = new URLSearchParams(window.location.search).get(
    "calendar_error",
  );
  return calendarErrorMessages[errorCode] || "";
};
const SETTINGS_ACCESS_KEY = "merz.admin.settings.access";

const integrationItems = [
  {
    key: "emailNotifications",
    title: "Email notifications",
    description:
      "Send booking updates and reminder emails when SMTP is configured.",
    connected: true,
  },
  {
    key: "appointmentReminders",
    title: "Appointment reminders",
    description: "Create in-app reminders for upcoming appointments.",
    connected: true,
  },
  {
    key: "googleLogin",
    title: "Google login",
    description: "Let customers sign in or register with Google.",
    connected: true,
  },
  {
    key: "googleCalendar",
    title: "Google Calendar",
    description: "Ready for calendar sync once the Calendar API is connected.",
    connected: false,
  },
  {
    key: "googleDrive",
    title: "Google Drive",
    description: "Save generated salon reports as PDFs in Google Drive.",
    connected: false,
  },
  {
    key: "pdfReports",
    title: "PDF report generator",
    description: "Allow admins to download and save appointment reports as PDFs.",
    connected: true,
  },
  {
    key: "embeddedMaps",
    title: "Embedded Google Maps",
    description: "Show the salon location map on the public landing page.",
    connected: true,
  },
  {
    key: "recaptchaRequired",
    title: "reCAPTCHA protection",
    description: "Require a security check on password login.",
    connected: true,
  },
];

const credentialGroups = [
  {
    key: "google-auth",
    title: "Google sign-in",
    description: "Client credentials and callback address for customer login.",
    fields: [
      { key: "googleClientId", label: "Google client ID", type: "text" },
      {
        key: "googleClientSecret",
        label: "Google client secret",
        type: "password",
      },
      {
        key: "googleOauthRedirectUri",
        label: "Google OAuth redirect URI",
        type: "url",
      },
    ],
  },
  {
    key: "google-calendar",
    title: "Google Calendar",
    description: "Calendar callback and embedded calendar settings.",
    fields: [
      {
        key: "googleCalendarRedirectUri",
        label: "Google Calendar redirect URI",
        type: "url",
      },
      {
        key: "calendarEmbedUrl",
        label: "Google Calendar embed URL",
        type: "url",
      },
    ],
  },
  {
    key: "email-delivery",
    title: "Email delivery",
    description: "The mail server used for booking updates and reminders.",
    fields: [
      { key: "smtpHost", label: "SMTP host", type: "text" },
      { key: "smtpPort", label: "SMTP port", type: "text" },
      { key: "smtpUser", label: "SMTP username", type: "text" },
      { key: "smtpPass", label: "SMTP password", type: "password" },
      { key: "smtpFrom", label: "Sender email", type: "email" },
    ],
  },
  {
    key: "recaptcha",
    title: "reCAPTCHA protection",
    description: "Secret key for the login security check.",
    fields: [
      {
        key: "recaptchaSecretKey",
        label: "reCAPTCHA secret key",
        type: "password",
      },
    ],
  },
];

const isConnectionMetadata = (key) =>
  [
    "secretsConfigured",
    "calendarConnected",
    "calendarEmail",
    "driveConnected",
    "driveEmail",
  ].includes(key);

// The page's copy of the settings, built from what the server returns.
const toSettingsState = (saved = {}) => ({
  ...initialSettings,
  ...Object.fromEntries(
    Object.entries(saved).filter(([key]) => !isConnectionMetadata(key)),
  ),
  calendarConnected: Boolean(saved.calendarConnected),
  calendarEmail: saved.calendarEmail || "",
  driveConnected: Boolean(saved.driveConnected),
  driveEmail: saved.driveEmail || "",
});

const GOOGLE_PAIR = ["googleClientId", "googleClientSecret"];

// What the credential modal edits: the Google client ID + secret pair, or
// a single field.
function findCredentialEditor(editorKey) {
  if (!editorKey) return null;
  if (editorKey === "google-auth") {
    const group = credentialGroups.find(({ key }) => key === "google-auth");
    return {
      key: editorKey,
      title: "Google client ID and secret",
      group,
      fields: group.fields.filter(({ key }) => GOOGLE_PAIR.includes(key)),
      isGooglePair: true,
    };
  }
  for (const group of credentialGroups) {
    const field = group.fields.find(({ key }) => key === editorKey);
    if (field) {
      return { key: editorKey, title: field.label, group, fields: [field], field };
    }
  }
  return null;
}

async function requestSettings(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Could not load integration settings.");
  }
  return payload;
}

function AdminSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialCalendarError);
  const [credentialError, setCredentialError] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const [credentials, setCredentials] = useState({});
  const [credentialValues, setCredentialValues] = useState({});
  const [editingCredential, setEditingCredential] = useState(null);
  const [settingsAccessToken, setSettingsAccessToken] = useState(() => {
    const stored = localStorage.getItem(SETTINGS_ACCESS_KEY);
    if (!stored) return "";
    try {
      const parsed = JSON.parse(stored);
      return parsed.authToken === localStorage.getItem("merz.auth.token")
        ? parsed.accessToken
        : "";
    } catch {
      localStorage.removeItem(SETTINGS_ACCESS_KEY);
      return "";
    }
  });
  const [superPin, setSuperPin] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);

  const requestSettingsAccess = async (event) => {
    event.preventDefault();
    setAccessLoading(true);
    setAccessError("");
    try {
      const payload = await requestSettings(
        "/api/v1/admin/settings/access/request",
        token,
        { method: "POST", body: JSON.stringify({ superPin }) },
      );
      setChallengeToken(payload.challengeToken);
      setSuperPin("");
    } catch (requestError) {
      setAccessError(requestError.message);
    } finally {
      setAccessLoading(false);
    }
  };

  const verifySettingsAccess = async (event) => {
    event.preventDefault();
    setAccessLoading(true);
    setAccessError("");
    try {
      const payload = await requestSettings(
        "/api/v1/admin/settings/access/verify",
        token,
        { method: "POST", body: JSON.stringify({ challengeToken, otp }) },
      );
      setSettingsAccessToken(payload.accessToken);
      localStorage.setItem(
        SETTINGS_ACCESS_KEY,
        JSON.stringify({
          authToken: token,
          accessToken: payload.accessToken,
        }),
      );
      setOtp("");
    } catch (requestError) {
      setAccessError(requestError.message);
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!settingsAccessToken) {
      return undefined;
    }
    requestSettings("/api/v1/admin/settings", token, {
      headers: { "X-Settings-Access-Token": settingsAccessToken },
    })
      .then((payload) => {
        if (active) {
          setSettings(toSettingsState(payload.settings));
          setCredentials(payload.settings.secretsConfigured || {});
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, settingsAccessToken]);

  const updateSetting = async (key) => {
    const nextSettings = { ...settings, [key]: !settings[key] };
    setSettings(nextSettings);
    setSaving(true);
    setError("");
    try {
      const settingsPayload = Object.fromEntries(
        Object.entries(nextSettings).filter(
          ([field]) => !isConnectionMetadata(field),
        ),
      );
      const payload = await requestSettings("/api/v1/admin/settings", token, {
        method: "PUT",
        headers: { "X-Settings-Access-Token": settingsAccessToken },
        body: JSON.stringify(settingsPayload),
      });
      setSettings(toSettingsState(payload.settings));
      setCredentials(payload.settings.secretsConfigured || {});
      toast.success("Settings saved.");
    } catch (requestError) {
      setSettings(settings);
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCredentialValues = async (values, successMessage) => {
    setSaving(true);
    setError("");
    try {
      const settingsPayload = Object.fromEntries(
        Object.entries(settings).filter(
          ([key]) => !isConnectionMetadata(key),
        ),
      );
      const payload = await requestSettings("/api/v1/admin/settings", token, {
        method: "PUT",
        headers: { "X-Settings-Access-Token": settingsAccessToken },
        body: JSON.stringify({ ...settingsPayload, ...values }),
      });
      setSettings(toSettingsState(payload.settings));
      setCredentials(payload.settings.secretsConfigured || {});
      setCredentialValues((current) => {
        const nextValues = { ...current };
        Object.keys(values).forEach((key) => delete nextValues[key]);
        return nextValues;
      });
      setEditingCredential(null);
      toast.success(successMessage);
    } catch (requestError) {
      setCredentialError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCredential = (field) => {
    const value = credentialValues[field.key];
    if (!value) return;
    return saveCredentialValues(
      { [field.key]: value },
      `${field.label} saved.`,
    );
  };

  const saveGoogleCredentials = () => {
    const values = {
      googleClientId: credentialValues.googleClientId || "",
      googleClientSecret: credentialValues.googleClientSecret || "",
    };
    if (!values.googleClientId && !values.googleClientSecret) return;
    if (
      (!credentials.googleClientId || !credentials.googleClientSecret) &&
      (!values.googleClientId || !values.googleClientSecret)
    ) {
      setCredentialError("Enter both the Google client ID and client secret.");
      return;
    }
    return saveCredentialValues(values, "Google sign-in credentials saved.");
  };

  const restoreCredentials = async () => {
    const confirmed = await confirm({
      title: "Restore credential defaults?",
      description:
        "Every credential saved here (Google sign-in, calendar, email delivery and reCAPTCHA) is removed, and the salon falls back to the server's environment settings. This can't be undone.",
      confirmLabel: "Restore defaults",
      tone: "danger",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const settingsPayload = Object.fromEntries(
        Object.entries(settings).filter(
          ([key]) => !isConnectionMetadata(key),
        ),
      );
      const payload = await requestSettings("/api/v1/admin/settings", token, {
        method: "PUT",
        headers: { "X-Settings-Access-Token": settingsAccessToken },
        body: JSON.stringify({ ...settingsPayload, resetCredentials: true }),
      });
      setSettings(toSettingsState(payload.settings));
      setCredentials(payload.settings.secretsConfigured || {});
      setCredentialValues({});
      setEditingCredential(null);
      toast.success("Credential defaults restored.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const credentialEditor = findCredentialEditor(editingCredential);

  const closeCredentialEditor = async () => {
    if (saving || !credentialEditor) return;
    const typed = credentialEditor.fields.some(
      ({ key }) => credentialValues[key],
    );
    if (
      typed &&
      !(await confirm({
        title: "Discard the new value?",
        description: "What you typed hasn't been saved.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "danger",
      }))
    ) {
      return;
    }
    setCredentialValues((current) => {
      const next = { ...current };
      credentialEditor.fields.forEach(({ key }) => delete next[key]);
      return next;
    });
    setEditingCredential(null);
  };

  if (!settingsAccessToken) {
    return (
      <div className="customer-page salon-landing admin-dashboard-page">
        <AdminNavigation />
        <Helmet>
          <title>Verify settings access | MERZ Beauty Salon</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <main id="admin-main" tabIndex={-1} className="customer-container admin-dashboard">
          <section className="customer-panel admin-settings-access-panel">
            <p className="customer-eyebrow">Salon control room</p>
            <h1>Verify settings access</h1>
            <p className="admin-settings-access-intro">
              Enter the settings super PIN, then use the one-time code sent to
              the admin email address.
            </p>
            {!challengeToken ? (
              <form className="admin-settings-access-form" onSubmit={requestSettingsAccess}>
                <label className="admin-settings-field">
                  <span>Settings super PIN</span>
                  <input
                    type="password"
                    value={superPin}
                    autoComplete="off"
                    onChange={(event) => setSuperPin(event.target.value)}
                    required
                  />
                </label>
                <button
                  className="customer-button customer-button-primary"
                  type="submit"
                  disabled={accessLoading}
                >
                  {accessLoading ? "Checking…" : "Send verification code"}
                </button>
              </form>
            ) : (
              <form className="admin-settings-access-form" onSubmit={verifySettingsAccess}>
                <label className="admin-settings-field">
                  <span>One-time verification code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    autoComplete="one-time-code"
                    onChange={(event) => setOtp(event.target.value)}
                    required
                  />
                </label>
                <button
                  className="customer-button customer-button-primary"
                  type="submit"
                  disabled={accessLoading}
                >
                  {accessLoading ? "Verifying…" : "Open settings"}
                </button>
              </form>
            )}
            {accessError && (
              <div className="customer-alert customer-alert-error" role="alert">
                {accessError}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="customer-page salon-landing admin-dashboard-page">
      <AdminNavigation />
      <Helmet>
        <title>Integrations and Settings | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main id="admin-main" tabIndex={-1} className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-section-heading">
          <div>
            <p className="customer-eyebrow">Salon control room</p>
            <h1>Integrations and settings</h1>
            <p className="customer-lede">
              Decide which channels are active for the salon and its customers.
            </p>
          </div>
          <Link className="customer-button customer-button-outline" to="/admin">
            Back to dashboard
          </Link>
        </header>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}

        <section
          className="customer-panel admin-settings-panel"
          aria-labelledby="admin-settings-heading"
        >
          <div className="customer-panel-header">
            <div>
              <h2 id="admin-settings-heading">Active channels</h2>
              <p>
                Switches take effect for new reminders and customer sign-in
                immediately.
              </p>
            </div>
            {saving && <span role="status">Saving…</span>}
          </div>
          {loading ? (
            <p role="status">Loading settings…</p>
          ) : (
            <div className="admin-settings-list">
              {integrationItems.map((item) => (
                <div className="admin-settings-row" key={item.key}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {!item.connected &&
                      !["googleCalendar", "googleDrive"].includes(item.key) && (
                      <span className="admin-settings-status">
                        Not connected
                      </span>
                    )}
                    {item.key === "googleCalendar" &&
                      settings.calendarConnected && (
                        <span className="admin-settings-status">
                          Connected
                          {settings.calendarEmail
                            ? ` as ${settings.calendarEmail}`
                            : ""}
                        </span>
                      )}
                    {item.key === "googleDrive" && settings.driveConnected && (
                      <span className="admin-settings-status">
                        Connected
                        {settings.driveEmail ? ` as ${settings.driveEmail}` : ""}
                      </span>
                    )}
                  </div>
                  {item.key === "googleCalendar" || item.key === "googleDrive" ? (
                    <div className="admin-settings-actions">
                      <button
                        className={`admin-settings-toggle${settings[item.key] ? " is-on" : ""}`}
                        type="button"
                        role="switch"
                        aria-checked={settings[item.key]}
                        aria-label={`${settings[item.key] ? "Disable" : "Enable"} ${item.title}`}
                        disabled={saving}
                        onClick={() => updateSetting(item.key)}
                      >
                        <span />
                        {settings[item.key] ? "On" : "Off"}
                      </button>
                      <button
                        className="customer-button customer-button-outline"
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          setError("");
                                                try {
                            const response = await fetch(
                              item.key === "googleCalendar"
                                ? "/api/v1/admin/calendar/connect"
                                : "/api/v1/admin/settings/drive/connect",
                              {
                                headers: {
                                  Accept: "application/json",
                                  "X-Settings-Access-Token": settingsAccessToken,
                                  Authorization: `Bearer ${token}`,
                                },
                              },
                            );
                            const payload = await response
                              .json()
                              .catch(() => ({}));
                            if (!response.ok) {
                              throw new Error(
                                payload.message ||
                                  `Could not connect ${item.title}.`,
                              );
                            }
                            window.location.href = payload.authorizationUrl;
                          } catch (requestError) {
                            setError(requestError.message);
                          }
                        }}
                      >
                        {(item.key === "googleCalendar"
                          ? settings.calendarConnected
                          : settings.driveConnected)
                          ? "Reconnect"
                          : "Connect"}
                      </button>
                    </div>
                  ) : (
                    <button
                      className={`admin-settings-toggle${settings[item.key] ? " is-on" : ""}`}
                      type="button"
                      role="switch"
                      aria-checked={settings[item.key]}
                      aria-label={`${settings[item.key] ? "Disable" : "Enable"} ${item.title}`}
                      disabled={saving}
                      onClick={() => updateSetting(item.key)}
                    >
                      <span />
                      {settings[item.key] ? "On" : "Off"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <section
          className="customer-panel admin-settings-panel"
          aria-labelledby="admin-credentials-heading"
        >
          <div className="customer-panel-header admin-credentials-header">
            <div>
              <h2 id="admin-credentials-heading">Integration credentials</h2>
              <p>
                Credentials are encrypted before they are stored. Existing
                values are never returned to the browser. Edit one connection
                at a time when a key needs replacing.
              </p>
            </div>
            <button
              className="admin-credentials-reset"
              type="button"
              disabled={saving}
              onClick={restoreCredentials}
            >
              Restore defaults
            </button>
          </div>
          <div className="admin-settings-credentials" aria-label="Integration credential fields">
            {credentialGroups.map((group) => (
              <article className="admin-credential-group" key={group.key}>
                <header className="admin-credential-group-header">
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </header>
                <div className="admin-credential-group-fields">
                  {group.fields.map((field) => {
                    const isGoogleCredentialPair =
                      group.key === "google-auth" &&
                      ["googleClientId", "googleClientSecret"].includes(
                        field.key,
                      );
                    if (
                      isGoogleCredentialPair &&
                      field.key === "googleClientSecret"
                    ) {
                      return null;
                    }

                    const editorKey = isGoogleCredentialPair
                      ? group.key
                      : field.key;
                    const isConfigured = isGoogleCredentialPair
                      ? credentials.googleClientId &&
                        credentials.googleClientSecret
                      : // Secrets are reported in secretsConfigured; plain
                        // settings like the calendar embed URL are not.
                        Object.hasOwn(credentials, field.key)
                        ? credentials[field.key]
                        : Boolean(settings[field.key]);

                    return (
                      <div className="admin-credential-item" key={field.key}>
                        <div className="admin-credential-summary">
                          <div>
                            <strong>
                              {isGoogleCredentialPair
                                ? "Google client ID and secret"
                                : field.label}
                            </strong>
                            <span className={isConfigured ? "is-configured" : ""}>
                              {isConfigured ? "Configured" : "Not configured"}
                            </span>
                          </div>
                          <button
                            className="admin-credential-edit"
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={`Edit ${isGoogleCredentialPair ? "Google client ID and secret" : field.label}`}
                            disabled={saving}
                            onClick={() => {
                              setCredentialError("");
                              setEditingCredential(editorKey);
                            }}
                          >
                            {isConfigured ? "Replace" : "Set up"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      {credentialEditor && (
        <Modal onClose={closeCredentialEditor}>
          <Modal.Header>
            <div>
              <Modal.Eyebrow>{credentialEditor.group.title}</Modal.Eyebrow>
              <Modal.Title>{credentialEditor.title}</Modal.Title>
              <Modal.Description>
                {credentialEditor.fields.some(({ key }) => credentials[key])
                  ? "The current value is stored encrypted and never shown. Enter a new value to replace it."
                  : credentialEditor.group.description}
              </Modal.Description>
            </div>
            <Modal.Close label="Close without saving" />
          </Modal.Header>
          <Modal.Body>
            {credentialError && (
              <p className="ui-note ui-note--error" role="alert">
                {credentialError}
              </p>
            )}
            <form
              id="credential-form"
              className="ui-form ui-form--single"
              onSubmit={(event) => {
                event.preventDefault();
                if (credentialEditor.isGooglePair) saveGoogleCredentials();
                else saveCredential(credentialEditor.field);
              }}
            >
              {credentialEditor.fields.map((editorField, index) => (
                <label className="ui-field" key={editorField.key}>
                  {editorField.label}
                  <input
                    name={editorField.key}
                    type={editorField.type}
                    value={credentialValues[editorField.key] || ""}
                    placeholder={
                      credentials[editorField.key] || settings[editorField.key]
                        ? "Enter a new value to replace the current one…"
                        : editorField.type === "url"
                          ? "https://…"
                          : "Enter a value…"
                    }
                    autoComplete={
                      editorField.type === "password" ? "new-password" : "off"
                    }
                    spellCheck={false}
                    data-autofocus={index === 0 ? true : undefined}
                    onChange={(event) => {
                      setCredentialError("");
                      setCredentialValues((current) => ({
                        ...current,
                        [editorField.key]: event.target.value,
                      }));
                    }}
                  />
                </label>
              ))}
            </form>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="customer-button customer-button-outline"
              type="button"
              onClick={closeCredentialEditor}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="customer-button customer-button-primary"
              type="submit"
              form="credential-form"
              disabled={
                saving ||
                !credentialEditor.fields.some(
                  ({ key }) => credentialValues[key],
                )
              }
            >
              {saving ? (
                <>
                  <span className="ui-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </Modal.Footer>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

export default AdminSettingsPage;
