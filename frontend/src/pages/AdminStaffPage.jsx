import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-staff.css";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

async function requestStaff(path, token, options = {}) {
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
    throw new Error(payload.message || "Could not manage staff accounts.");
  }
  return payload;
}

function AdminStaffPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [listLoadError, setListLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    requestStaff("/api/admin/staff", token)
      .then((payload) => {
        if (active) setStaff(payload.staff || []);
      })
      .catch((requestError) => {
        if (active) {
          setListLoadError(true);
          setError(requestError.message || "Could not load staff accounts.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const updateField = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError("");
    setNotice("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const payload = await requestStaff("/api/admin/staff", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });
      setStaff((current) =>
        [...current, payload.staff].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      setForm(emptyForm);
      setNotice(`${payload.staff.name} can now log in to the staff dashboard.`);
    } catch (requestError) {
      setError(requestError.message || "Could not create this staff account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="customer-page salon-landing admin-staff-page">
      <Helmet>
        <title>Staff Accounts | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-staff">
        <header className="customer-page-heading admin-staff__heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Staff accounts</h1>
            <p className="customer-lede">
              Create secure sign-ins for your team and keep access to salon
              schedules in the right hands.
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
          <div className="customer-alert admin-staff__notice" role="status">
            {notice}
          </div>
        )}

        <div className="admin-staff__layout">
          <section className="customer-panel admin-staff__form-panel">
            <h2>Add a team member</h2>
            <p>
              Their account will have staff access to appointments and schedules.
            </p>
            <form className="admin-staff__form" onSubmit={submit}>
              <label>
                Full name
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  autoComplete="name"
                  minLength="2"
                  maxLength="120"
                  required
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  autoComplete="email"
                  maxLength="254"
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={updateField}
                  autoComplete="tel"
                  minLength="7"
                  maxLength="30"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  autoComplete="new-password"
                  minLength="8"
                  maxLength="128"
                  required
                />
                <span className="admin-staff__hint">
                  At least 8 characters. Share it with the team member through a
                  secure channel.
                </span>
              </label>
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  autoComplete="new-password"
                  minLength="8"
                  maxLength="128"
                  required
                />
              </label>
              <button
                className="customer-button admin-staff__submit"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating account..." : "Create staff account"}
              </button>
            </form>
          </section>

          <section
            className="customer-panel admin-staff__list-panel"
            aria-labelledby="admin-staff-list-heading"
          >
            <div className="admin-staff__list-heading">
              <div>
                <h2 id="admin-staff-list-heading">Your team</h2>
                <p>Staff accounts with access to the salon schedule.</p>
              </div>
              <span>{staff.length}</span>
            </div>
            {loading ? (
              <p role="status">Loading staff accounts…</p>
            ) : listLoadError ? (
              <p className="customer-empty-state">
                Staff accounts could not be loaded.
              </p>
            ) : staff.length === 0 ? (
              <p className="customer-empty-state">
                No staff accounts yet. Add a team member to get started.
              </p>
            ) : (
              <ul className="admin-staff__list">
                {staff.map((member) => (
                  <li className="admin-staff__member" key={member._id}>
                    <span className="admin-staff__avatar" aria-hidden="true">
                      {member.name.charAt(0).toLocaleUpperCase()}
                    </span>
                    <span className="admin-staff__member-details">
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </span>
                    <span className="admin-staff__role">Staff</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default AdminStaffPage;
