import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import AdminNavigation from "../components/admin/AdminNavigation.jsx";

const initialSettings = {
  emailNotifications: true,
  appointmentReminders: true,
  googleCalendar: false,
  googleLogin: false,
  embeddedMaps: true,
  recaptchaRequired: false,
  calendarConnected: false,
  calendarEmail: "",
};

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

const secretFields = [
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
  { key: "smtpHost", label: "SMTP host", type: "text" },
  { key: "smtpPort", label: "SMTP port", type: "text" },
  { key: "smtpUser", label: "SMTP username", type: "text" },
  { key: "smtpPass", label: "SMTP password", type: "password" },
  { key: "smtpFrom", label: "Sender email", type: "email" },
  {
    key: "recaptchaSecretKey",
    label: "reCAPTCHA secret key",
    type: "password",
  },
];

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState({});

  useEffect(() => {
    let active = true;
    requestSettings("/api/admin/settings", token)
      .then((payload) => {
        if (active) {
          const savedSettings = Object.fromEntries(
            Object.entries(payload.settings).filter(
              ([key]) =>
                ![
                  "secretsConfigured",
                  "calendarConnected",
                  "calendarEmail",
                ].includes(key),
            ),
          );
          setSettings({
            ...initialSettings,
            ...savedSettings,
            calendarConnected: Boolean(payload.settings.calendarConnected),
            calendarEmail: payload.settings.calendarEmail || "",
          });
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
  }, [token]);

  const updateSetting = async (key) => {
    const nextSettings = { ...settings, [key]: !settings[key] };
    setSettings(nextSettings);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const settingsPayload = Object.fromEntries(
        Object.entries(nextSettings).filter(
          ([field]) => !["calendarConnected", "calendarEmail"].includes(field),
        ),
      );
      const payload = await requestSettings("/api/admin/settings", token, {
        method: "PUT",
        body: JSON.stringify(settingsPayload),
      });
      const savedSettings = Object.fromEntries(
        Object.entries(payload.settings).filter(
          ([key]) =>
            ![
              "secretsConfigured",
              "calendarConnected",
              "calendarEmail",
            ].includes(key),
        ),
      );
      setSettings({
        ...initialSettings,
        ...savedSettings,
        calendarConnected: Boolean(payload.settings.calendarConnected),
        calendarEmail: payload.settings.calendarEmail || "",
      });
      setCredentials(payload.settings.secretsConfigured || {});
      setNotice("Settings saved.");
    } catch (requestError) {
      setSettings(settings);
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="customer-page salon-landing admin-dashboard-page">
      <AdminNavigation />
      <Helmet>
        <title>Integrations and Settings | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
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
        {notice && (
          <div className="customer-alert customer-alert-success" role="status">
            {notice}
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
                    {!item.connected && item.key !== "googleCalendar" && (
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
                  </div>
                  {item.key === "googleCalendar" ? (
                    <div className="admin-settings-actions">
                      <button
                        className={`admin-settings-toggle${settings.googleCalendar ? " is-on" : ""}`}
                        type="button"
                        role="switch"
                        aria-checked={settings.googleCalendar}
                        aria-label={`${settings.googleCalendar ? "Disable" : "Enable"} Google Calendar`}
                        disabled={saving}
                        onClick={() => updateSetting("googleCalendar")}
                      >
                        <span />
                        {settings.googleCalendar ? "On" : "Off"}
                      </button>
                      <button
                        className="customer-button customer-button-outline"
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          setError("");
                          setNotice("");
                          try {
                            const response = await fetch(
                              "/api/admin/calendar/connect",
                              {
                                headers: {
                                  Accept: "application/json",
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
                                  "Could not connect Google Calendar.",
                              );
                            }
                            window.location.href = payload.authorizationUrl;
                          } catch (requestError) {
                            setError(requestError.message);
                          }
                        }}
                      >
                        {settings.calendarConnected ? "Reconnect" : "Connect"}
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
          <div className="customer-panel-header">
            <div>
              <h2 id="admin-credentials-heading">Integration credentials</h2>
              <p>
                Credentials are encrypted before they are stored. Existing
                values are never returned to the browser; leave a field blank to
                keep it.
              </p>
            </div>
          </div>
          <div className="admin-settings-credentials">
            {secretFields.map((field) => (
              <label className="admin-settings-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  type={field.type}
                  placeholder={
                    credentials[field.key]
                      ? "Configured — enter a new value to replace"
                      : ""
                  }
                  autoComplete="new-password"
                  onChange={(event) =>
                    setCredentials((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="customer-button customer-button-primary"
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError("");
              setNotice("");
              const settingsPayload = Object.fromEntries(
                Object.entries(settings).filter(
                  ([key]) =>
                    !["calendarConnected", "calendarEmail"].includes(key),
                ),
              );
              requestSettings("/api/admin/settings", token, {
                method: "PUT",
                body: JSON.stringify({
                  ...settingsPayload,
                  ...Object.fromEntries(
                    secretFields
                      .filter(
                        ({ key }) =>
                          credentials[key] &&
                          typeof credentials[key] === "string",
                      )
                      .map(({ key }) => [key, credentials[key]]),
                  ),
                }),
              })
                .then((payload) => {
                  const savedSettings = Object.fromEntries(
                    Object.entries(payload.settings).filter(
                      ([key]) =>
                        ![
                          "secretsConfigured",
                          "calendarConnected",
                          "calendarEmail",
                        ].includes(key),
                    ),
                  );
                  setSettings({
                    ...initialSettings,
                    ...savedSettings,
                    calendarConnected: Boolean(
                      payload.settings.calendarConnected,
                    ),
                    calendarEmail: payload.settings.calendarEmail || "",
                  });
                  setCredentials(payload.settings.secretsConfigured || {});
                  setNotice("Integration credentials saved.");
                })
                .catch((requestError) => setError(requestError.message))
                .finally(() => setSaving(false));
            }}
          >
            Save credentials
          </button>
        </section>
      </main>
    </div>
  );
}

export default AdminSettingsPage;
