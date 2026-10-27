import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import AdminNavigation from "../components/admin/AdminNavigation.jsx";
import "../styles/admin-staff.css";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
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
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState({ name: "", phone: "" });
  const [editingSaving, setEditingSaving] = useState(false);

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
    setTemporaryPassword("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    setSaving(true);
    try {
      const payload = await requestStaff("/api/admin/staff", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });
      setStaff((current) =>
        [...current, payload.staff].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      setForm(emptyForm);
      setTemporaryPassword(payload.temporaryPassword || "");
      setNotice(
        `${payload.staff.name} can now log in. Share the temporary password once.`,
      );
    } catch (requestError) {
      setError(requestError.message || "Could not create this staff account.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (member) => {
    setEditingId(member._id);
    setEditDraft({ name: member.name, phone: member.phone || "" });
    setError("");
    setNotice("");
    setTemporaryPassword("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setEditingSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await requestStaff(
        `/api/admin/staff/${encodeURIComponent(editingId)}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editDraft.name.trim(),
            phone: editDraft.phone.trim(),
          }),
        },
      );
      setStaff((current) =>
        current
          .map((member) => (member._id === editingId ? payload.staff : member))
          .sort((first, second) => first.name.localeCompare(second.name)),
      );
      setEditingId("");
      setNotice("Staff account details updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not update this staff account.");
    } finally {
      setEditingSaving(false);
    }
  };

  const resetPassword = async (member) => {
    setEditingSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await requestStaff(
        `/api/admin/staff/${encodeURIComponent(member._id)}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ resetPassword: true }),
        },
      );
      setStaff((current) =>
        current.map((item) =>
          item._id === member._id ? payload.staff : item,
        ),
      );
      setTemporaryPassword(payload.temporaryPassword || "");
      setNotice(
        `A new temporary password was generated for ${member.name}. Share it securely once.`,
      );
    } catch (requestError) {
      setError(requestError.message || "Could not reset this staff password.");
    } finally {
      setEditingSaving(false);
    }
  };

  return (
    <div className="customer-page salon-landing admin-staff-page">
      <AdminNavigation />
      <Helmet>
        <title>Staff Accounts | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-staff">
        <header className="customer-page-heading admin-section-heading">
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
        {temporaryPassword && (
          <div className="customer-alert admin-staff__temporary-password" role="status">
            <strong>Temporary password — share it securely now:</strong>{" "}
            <code>{temporaryPassword}</code>
            <button
              type="button"
              onClick={() => setTemporaryPassword("")}
            >
              Hide password
            </button>
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
              <p className="admin-staff__hint">
                A temporary password will be generated after you create the
                account. The team member must replace it at first sign-in.
              </p>
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
                    {editingId === member._id ? (
                      <form className="admin-staff__edit-form" onSubmit={saveEdit}>
                        <label>
                          Name
                          <input
                            value={editDraft.name}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            minLength="2"
                            maxLength="120"
                            required
                          />
                        </label>
                        <label>
                          Phone
                          <input
                            value={editDraft.phone}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                phone: event.target.value,
                              }))
                            }
                            minLength="7"
                            maxLength="30"
                            required
                          />
                        </label>
                        <span className="admin-staff__member-email">
                          Email: {member.email}
                        </span>
                        <div className="admin-staff__edit-actions">
                          <button type="submit" disabled={editingSaving}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId("")}
                            disabled={editingSaving}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="admin-staff__member-details">
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                          <span>{member.phone || "No phone number"}</span>
                        </span>
                        <span className="admin-staff__role">Staff</span>
                        <div className="admin-staff__member-actions">
                          <button type="button" onClick={() => startEditing(member)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(member)}
                            disabled={editingSaving}
                          >
                            Reset password
                          </button>
                        </div>
                      </>
                    )}
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
