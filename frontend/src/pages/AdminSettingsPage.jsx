import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";

const initialSettings = {
  emailNotifications: true,
  appointmentReminders: true,
  googleCalendar: false,
  googleLogin: false,
};

const integrationItems = [
  {
    key: "emailNotifications",
    title: "Email notifications",
    description: "Send reminder emails when SMTP is configured.",
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

  useEffect(() => {
    let active = true;
    requestSettings("/api/admin/settings", token)
      .then((payload) => {
        if (active) setSettings({ ...initialSettings, ...payload.settings });
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
      const payload = await requestSettings("/api/admin/settings", token, {
        method: "PUT",
        body: JSON.stringify(nextSettings),
      });
      setSettings({ ...initialSettings, ...payload.settings });
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

        {error && <div className="customer-alert customer-alert-error" role="alert">{error}</div>}
        {notice && <div className="customer-alert customer-alert-success" role="status">{notice}</div>}

        <section className="customer-panel admin-settings-panel" aria-labelledby="admin-settings-heading">
          <div className="customer-panel-header">
            <div>
              <h2 id="admin-settings-heading">Active channels</h2>
              <p>Switches take effect for new reminders and customer sign-in immediately.</p>
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
                    {!item.connected && <span className="admin-settings-status">Not connected</span>}
                  </div>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminSettingsPage;
