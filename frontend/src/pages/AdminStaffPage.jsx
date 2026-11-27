import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import AdminNavigation from "../components/admin/AdminNavigation.jsx";
import Modal from "../components/admin/ui/Modal.jsx";
import useConfirm from "../components/admin/ui/useConfirm.jsx";
import { toast } from "../components/admin/ui/toast.js";
import StaffForm from "../components/admin/StaffForm.jsx";
import {
  emptyStaffForm,
  isStaffFormDirty,
  staffRoleLabel,
  toStaffForm,
  toStaffPayload,
} from "../components/admin/staffRoles.js";
import "../styles/admin-staff.css";

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

const byName = (first, second) => first.name.localeCompare(second.name);

function AdminStaffPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // The open modal: null, { mode: "add" } or { mode: "edit", member }.
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyStaffForm);
  const [initialForm, setInitialForm] = useState(emptyStaffForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  // Shown once after creating an account or resetting a password.
  const [credentials, setCredentials] = useState(null);
  const [resettingId, setResettingId] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    let active = true;

    requestStaff("/api/v1/admin/staff", token)
      .then((payload) => {
        if (active) setStaff(payload.staff || []);
      })
      .catch((requestError) => {
        if (active) {
          setLoadError(requestError.message || "Could not load staff accounts.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const openModal = (next) => {
    const values = next.member ? toStaffForm(next.member) : emptyStaffForm;
    setForm(values);
    setInitialForm(values);
    setModalError("");
    setModal(next);
  };

  const requestClose = async () => {
    if (saving) return;
    if (
      isStaffFormDirty(form, initialForm) &&
      !(await confirm({
        title: "Discard your changes?",
        description: "The details you entered haven't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
      }))
    ) {
      return;
    }
    setModal(null);
  };

  const showCredentials = (member, temporaryPassword, reason) => {
    if (!temporaryPassword) return;
    setCopied(false);
    setCredentials({ member, temporaryPassword, reason });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setModalError("");
    try {
      if (modal.mode === "edit") {
        const payload = await requestStaff(
          `/api/v1/admin/staff/${encodeURIComponent(modal.member._id)}`,
          token,
          { method: "PUT", body: JSON.stringify(toStaffPayload(form)) },
        );
        setStaff((current) =>
          current
            .map((member) =>
              member._id === modal.member._id ? payload.staff : member,
            )
            .sort(byName),
        );
        setModal(null);
        toast.success(`${payload.staff.name}'s details were updated.`);
      } else {
        const payload = await requestStaff("/api/v1/admin/staff", token, {
          method: "POST",
          body: JSON.stringify(toStaffPayload(form)),
        });
        setStaff((current) => [...current, payload.staff].sort(byName));
        setModal(null);
        showCredentials(payload.staff, payload.temporaryPassword, "created");
      }
    } catch (requestError) {
      setModalError(
        requestError.message ||
          (modal.mode === "edit"
            ? "Could not update this staff account."
            : "Could not create this staff account."),
      );
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (member) => {
    if (resettingId) return;
    const confirmed = await confirm({
      title: `Reset ${member.name}'s password?`,
      description:
        "Their current password stops working right away. You'll get a temporary password to share with them, and they must change it at their next sign-in.",
      confirmLabel: "Reset password",
      tone: "danger",
    });
    if (!confirmed) return;

    setResettingId(member._id);
    try {
      const payload = await requestStaff(
        `/api/v1/admin/staff/${encodeURIComponent(member._id)}`,
        token,
        { method: "PUT", body: JSON.stringify({ resetPassword: true }) },
      );
      setStaff((current) =>
        current.map((item) => (item._id === member._id ? payload.staff : item)),
      );
      showCredentials(payload.staff, payload.temporaryPassword, "reset");
    } catch (requestError) {
      toast.error(requestError.message || "Could not reset this staff password.");
    } finally {
      setResettingId("");
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy automatically. Select the password and copy it.");
    }
  };

  const closeCredentials = () => {
    const { member, reason } = credentials;
    setCredentials(null);
    toast.success(
      reason === "created"
        ? `${member.name} can now sign in.`
        : `${member.name}'s password was reset.`,
    );
  };

  const roleCounts = staff.reduce((counts, member) => {
    const label = staffRoleLabel(member.role);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="customer-page salon-landing admin-staff-page">
      <AdminNavigation />
      <Helmet>
        <title>Staff Accounts | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main id="admin-main" tabIndex={-1} className="customer-container admin-staff">
        <header className="customer-page-heading admin-section-heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Staff accounts</h1>
            <p className="customer-lede">
              Create secure sign-ins for your team and keep access to salon
              schedules in the right hands.
            </p>
          </div>
          <button
            className="customer-button customer-button-primary admin-staff__add"
            type="button"
            onClick={() => openModal({ mode: "add" })}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add team member
          </button>
        </header>

        {loadError && (
          <div className="customer-alert customer-alert-error" role="alert">
            {loadError} Refresh the page to try again.
          </div>
        )}

        <section
          className="customer-panel admin-staff__list-panel"
          aria-labelledby="admin-staff-list-heading"
        >
          <div className="admin-staff__list-heading">
            <div>
              <h2 id="admin-staff-list-heading">Your team</h2>
              <p className="admin-tabular">
                {loading
                  ? "Loading…"
                  : staff.length === 0
                    ? "No accounts yet"
                    : Object.entries(roleCounts)
                        .map(([label, count]) => `${count} ${label.toLocaleLowerCase()}${count === 1 ? "" : "s"}`)
                        .join(" · ")}
              </p>
            </div>
          </div>
          {loading ? (
            <ul className="admin-staff__list" aria-busy="true">
              <li className="admin-dashboard__visually-hidden" role="status">
                Loading staff accounts…
              </li>
              {[0, 1, 2].map((item) => (
                <li className="admin-staff__member admin-staff__skeleton" key={item}>
                  <span className="admin-staff__avatar" />
                  <span>
                    <span />
                    <span />
                  </span>
                </li>
              ))}
            </ul>
          ) : !loadError && staff.length === 0 ? (
            <div className="admin-staff__empty">
              <p>No staff accounts yet. Add your first team member to get started.</p>
              <button
                className="customer-button customer-button-primary"
                type="button"
                onClick={() => openModal({ mode: "add" })}
              >
                Add team member
              </button>
            </div>
          ) : (
            <ul className="admin-staff__list">
              {staff.map((member) => (
                <li className="admin-staff__member" key={member._id}>
                  <span
                    className={`admin-staff__avatar admin-staff__avatar--${member.role || "staff"}`}
                    aria-hidden="true"
                  >
                    {member.name.charAt(0).toLocaleUpperCase()}
                  </span>
                  <span className="admin-staff__member-details">
                    <strong>{member.name}</strong>
                    <span translate="no">{member.email}</span>
                    <span>{member.phone || "No phone number"}</span>
                  </span>
                  <span
                    className={`admin-staff__role admin-staff__role--${member.role || "staff"}`}
                  >
                    {staffRoleLabel(member.role)}
                  </span>
                  <div className="admin-staff__member-actions">
                    <button
                      className="customer-button customer-button-outline"
                      type="button"
                      onClick={() => openModal({ mode: "edit", member })}
                      aria-label={`Edit ${member.name}`}
                    >
                      Edit
                    </button>
                    <button
                      className="customer-button customer-button-outline"
                      type="button"
                      onClick={() => resetPassword(member)}
                      aria-busy={resettingId === member._id || undefined}
                      disabled={Boolean(resettingId) && resettingId !== member._id}
                      aria-label={`Reset password for ${member.name}`}
                    >
                      {resettingId === member._id ? (
                        <>
                          <span className="admin-spinner" aria-hidden="true" />
                          Resetting…
                        </>
                      ) : (
                        "Reset password"
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {modal && (
        <Modal onClose={requestClose} size="wide">
          <Modal.Header>
            <div>
              <Modal.Eyebrow>
                {modal.mode === "edit" ? "Edit team member" : "New team member"}
              </Modal.Eyebrow>
              <Modal.Title>
                {modal.mode === "edit" ? modal.member.name : "Add a team member"}
              </Modal.Title>
              <Modal.Description>
                {modal.mode === "edit"
                  ? "Update their contact details or change what they can access."
                  : "A temporary password is generated when you create the account. They must replace it at their first sign-in."}
              </Modal.Description>
            </div>
            <Modal.Close label="Close without saving" />
          </Modal.Header>
          <Modal.Body>
            {modalError && (
              <p className="admin-note admin-note--error" role="alert">
                {modalError}
              </p>
            )}
            <StaffForm
              id="staff-form"
              form={form}
              onChange={(next) => {
                setForm(next);
                setModalError("");
              }}
              onSubmit={submit}
            />
          </Modal.Body>
          <Modal.Footer>
            <button
              className="customer-button customer-button-outline"
              type="button"
              onClick={requestClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="customer-button customer-button-primary"
              type="submit"
              form="staff-form"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="admin-spinner" aria-hidden="true" />
                  {modal.mode === "edit" ? "Saving…" : "Creating…"}
                </>
              ) : modal.mode === "edit" ? (
                "Save changes"
              ) : (
                "Create account"
              )}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {credentials && (
        // Closing needs a deliberate click on Done, so the password isn't
        // lost to a stray Escape or backdrop click.
        <Modal onClose={() => {}} size="narrow">
          <Modal.Header>
            <div>
              <Modal.Eyebrow>
                {credentials.reason === "created" ? "Account created" : "Password reset"}
              </Modal.Eyebrow>
              <Modal.Title>Temporary password for {credentials.member.name}</Modal.Title>
              <Modal.Description>
                Share it with them securely. It is shown only once, and they
                must change it when they sign in.
              </Modal.Description>
            </div>
          </Modal.Header>
          <Modal.Body>
            <div className="admin-staff__password">
              <code translate="no">{credentials.temporaryPassword}</code>
              <button
                className="customer-button customer-button-outline"
                type="button"
                onClick={copyPassword}
                data-autofocus
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="admin-staff__password-hint">
              Sign-in email: <span translate="no">{credentials.member.email}</span>
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="customer-button customer-button-primary"
              type="button"
              onClick={closeCredentials}
            >
              Done
            </button>
          </Modal.Footer>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

export default AdminStaffPage;
