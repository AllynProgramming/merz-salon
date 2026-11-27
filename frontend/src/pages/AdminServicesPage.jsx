import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import { formatPrice } from "../components/booking/bookingUtils.js";
import {
  createService,
  getAdminServices,
  getServiceEditLocks,
  archiveService,
  lockServiceForEdit,
  releaseServiceEditLock,
  restoreService,
  updateService,
} from "../services/bookingApi.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import AdminNavigation from "../components/admin/AdminNavigation.jsx";
import "../styles/admin-services.css";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  priceVaries: false,
  durationMinutes: "",
  category: "",
};

// Renew your place well inside the server's 60 second lease. While waiting
// behind another admin, check more often so Save unlocks soon after they
// finish.
const LOCK_HEARTBEAT_MS = 20 * 1000;
const LOCK_WAITING_HEARTBEAT_MS = 5 * 1000;
// How often to refresh which services other admins are editing.
const LOCK_REFRESH_MS = 10 * 1000;

const isLockConflict = (error) => error?.status === 423 || error?.status === 409;

const formatOpenedAt = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
        new Date(value),
      )
    : "";

const toForm = (service) => ({
  name: service.name,
  description: service.description || "",
  price: service.price == null ? "" : String(service.price),
  priceVaries: service.price == null,
  durationMinutes: String(service.durationMinutes),
  category: service.category || "",
});

function AdminServicesPage() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [locks, setLocks] = useState({});
  const [serviceFilter, setServiceFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [lockToken, setLockToken] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Latest edit session, for cleanup handlers that outlive a render.
  const editSessionRef = useRef({ serviceId: "", lockToken: "", token });
  useEffect(() => {
    editSessionRef.current = { serviceId: editingId, lockToken, token };
  }, [editingId, lockToken, token]);

  useEffect(() => {
    let active = true;

    getAdminServices(token)
      .then(({ services: items, locks: activeLocks }) => {
        if (active) {
          setServices(items);
          setLocks(activeLocks);
        }
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "Could not load salon services.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const refreshLocks = useCallback(async () => {
    try {
      setLocks(
        await getServiceEditLocks(token, editSessionRef.current.lockToken),
      );
    } catch {
      // Lock badges are informative; the server still enforces the lock.
    }
  }, [token]);

  // Keep the "being edited by" badges current.
  useEffect(() => {
    const interval = window.setInterval(refreshLocks, LOCK_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshLocks();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshLocks]);

  // Release the lock if the admin closes the tab or leaves the page.
  useEffect(() => {
    const release = () => {
      const session = editSessionRef.current;
      if (session.serviceId && session.lockToken) {
        releaseServiceEditLock(
          session.serviceId,
          session.token,
          session.lockToken,
        );
      }
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, []);

  const resetEditState = () => {
    setEditingId("");
    setLockToken("");
    setForm(emptyForm);
  };

  const cancelEdit = () => {
    const { serviceId, lockToken: currentToken } = editSessionRef.current;
    if (serviceId && currentToken) {
      releaseServiceEditLock(serviceId, token, currentToken).then(refreshLocks);
    }
    resetEditState();
  };

  const myLock = editingId ? locks[editingId] : null;
  const myPosition = myLock?.position ?? 1;
  const waitingFor = editingId && myPosition > 1 ? myLock?.editors?.[0] : null;

  // Tell the admin when the one ahead of them finishes.
  const previousWaitingForRef = useRef(null);
  useEffect(() => {
    const previous = previousWaitingForRef.current;
    if (previous && !waitingFor && editingId) {
      setNotice(
        `${previous.holderName || "The other admin"} finished. You can save your changes now.`,
      );
    }
    previousWaitingForRef.current = waitingFor;
  }, [waitingFor, editingId]);

  const loseLock = useCallback(
    (message) => {
      setEditingId("");
      setLockToken("");
      setForm(emptyForm);
      setNotice("");
      setError(message);
      refreshLocks();
    },
    [refreshLocks],
  );

  // Heartbeat: keep your place in line while the edit form is open, and
  // learn when the admin ahead of you is done.
  const isWaiting = Boolean(waitingFor);
  useEffect(() => {
    if (!editingId || !lockToken) return undefined;

    const interval = window.setInterval(
      async () => {
        try {
          const { lock } = await lockServiceForEdit(editingId, token, lockToken);
          setLocks((current) => ({ ...current, [editingId]: lock }));
        } catch (requestError) {
          if (isLockConflict(requestError)) {
            loseLock("Your editing session expired. Click Edit to continue.");
          }
        }
      },
      isWaiting ? LOCK_WAITING_HEARTBEAT_MS : LOCK_HEARTBEAT_MS,
    );

    return () => window.clearInterval(interval);
  }, [editingId, lockToken, token, loseLock, isWaiting]);

  const beginEdit = async (service) => {
    if (editingId === service._id) return;

    setError("");
    setNotice("");
    setOpeningId(service._id);
    try {
      const { token: newLockToken, lock } = await lockServiceForEdit(
        service._id,
        token,
      );

      // Switching from another service: release the old lock first.
      const previous = editSessionRef.current;
      if (previous.serviceId && previous.lockToken) {
        releaseServiceEditLock(previous.serviceId, token, previous.lockToken);
      }

      setEditingId(service._id);
      setLockToken(newLockToken);
      setLocks((current) => {
        const next = { ...current, [service._id]: lock };
        if (previous.serviceId) delete next[previous.serviceId];
        return next;
      });
      setForm(toForm(service));
    } catch (requestError) {
      setError(requestError.message || "Could not open this service for editing.");
    } finally {
      setOpeningId("");
    }
  };

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
    setSaving(true);
    setError("");
    setNotice("");
    const serviceData = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.priceVaries ? null : Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      category: form.category.trim(),
    };

    try {
      if (editingId) {
        const { service } = await updateService(
          editingId,
          serviceData,
          token,
          lockToken,
        );
        setServices((current) =>
          current.map((item) => (item._id === editingId ? service : item)),
        );
        // The server releases the lock after a successful save.
        setLocks((current) => {
          const next = { ...current };
          delete next[editingId];
          return next;
        });
        resetEditState();
        setNotice("Service updated.");
      } else {
        const { service } = await createService(serviceData, token);
        setServices((current) =>
          [...current, service].sort((first, second) =>
            first.name.localeCompare(second.name),
          ),
        );
        resetEditState();
        setNotice("Service added.");
      }
    } catch (requestError) {
      const code = requestError.details?.code;
      if (editingId && code === "SERVICE_CHANGED" && requestError.details.service) {
        // Someone ahead saved first: show their version before this admin
        // saves over it.
        const latest = requestError.details.service;
        setServices((current) =>
          current.map((item) => (item._id === editingId ? latest : item)),
        );
        setForm(toForm(latest));
        setError(requestError.message);
      } else if (editingId && code === "SERVICE_LOCKED") {
        // Still behind another admin: keep the form and the typed changes.
        if (requestError.details.lock) {
          setLocks((current) => ({
            ...current,
            [editingId]: requestError.details.lock,
          }));
        }
        setError(requestError.message);
      } else if (editingId && isLockConflict(requestError)) {
        loseLock(requestError.message);
      } else {
        setError(requestError.message || "Could not save this service.");
      }
    } finally {
      setSaving(false);
    }
  };

  const archive = async (service) => {
    const confirmed = window.confirm(
      `Archive "${service.name}"? It will no longer be available for booking.`,
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    const ownLockToken = editingId === service._id ? lockToken : "";
    try {
      const { service: archivedService } = await archiveService(
        service._id,
        token,
        ownLockToken,
      );
      setServices((current) =>
        current.map((item) =>
          item._id === archivedService._id ? archivedService : item,
        ),
      );
      if (editingId === service._id) cancelEdit();
      setNotice(
        `${service.name} was archived and is no longer available for booking.`,
      );
    } catch (requestError) {
      setError(requestError.message || "Could not archive this service.");
      if (isLockConflict(requestError)) refreshLocks();
    }
  };

  const restore = async (service) => {
    setError("");
    setNotice("");
    const ownLockToken = editingId === service._id ? lockToken : "";
    try {
      const { service: restoredService } = await restoreService(
        service._id,
        token,
        ownLockToken,
      );
      setServices((current) =>
        current.map((item) =>
          item._id === restoredService._id ? restoredService : item,
        ),
      );
      setNotice(`${service.name} was restored to the service menu.`);
    } catch (requestError) {
      setError(requestError.message || "Could not restore this service.");
      if (isLockConflict(requestError)) refreshLocks();
    }
  };

  const availableCount = services.filter((service) => service.isActive).length;
  const archivedCount = services.length - availableCount;
  const filteredServices = services.filter((service) => {
    if (serviceFilter === "available") return service.isActive;
    if (serviceFilter === "archived") return !service.isActive;
    return true;
  });

  return (
    <div className="customer-page salon-landing admin-services-page">
      <AdminNavigation />
      <Helmet>
        <title>Manage Services | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-services">
        <header className="customer-page-heading admin-section-heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Manage Services</h1>
            <p className="customer-lede">
              Add services to your menu or update their details and availability.
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
          <div className="customer-alert admin-services__notice" role="status">
            {notice}
          </div>
        )}

        <section className="customer-panel admin-services__form-panel">
          <h2>{editingId ? "Edit service" : "Add a service"}</h2>
          {waitingFor && (
            <p className="admin-services__queue-note" role="status">
              {waitingFor.holderName || "Another admin"} opened this service at{" "}
              {formatOpenedAt(waitingFor.openedAt)} and takes precedence. You
              can keep making changes. Save unlocks when they finish.
            </p>
          )}
          <form className="admin-services__form" onSubmit={submit}>
            <label>
              Service name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                minLength="2"
                maxLength="120"
                required
              />
            </label>
            <label>
              Category
              <input
                name="category"
                value={form.category}
                onChange={updateField}
                maxLength="60"
              />
            </label>
            <label>
              Price
              <input
                name="price"
                type="number"
                value={form.price}
                onChange={updateField}
                min="0"
                step="0.01"
                disabled={form.priceVaries}
                required={!form.priceVaries}
              />
            </label>
            <label className="admin-services__price-varies">
              <input
                type="checkbox"
                checked={form.priceVaries}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    priceVaries: event.target.checked,
                  }));
                  setError("");
                  setNotice("");
                }}
              />
              Price varies
            </label>
            <label>
              Duration (minutes)
              <input
                name="durationMinutes"
                type="number"
                value={form.durationMinutes}
                onChange={updateField}
                min="1"
                max="600"
                step="1"
                required
              />
            </label>
            <label className="admin-services__description">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                maxLength="1000"
                rows="3"
              />
            </label>
            <div className="admin-services__form-actions">
              <button
                className="customer-button customer-button-primary"
                type="submit"
                disabled={saving || Boolean(waitingFor)}
              >
                {saving
                  ? "Saving…"
                  : waitingFor
                    ? `Waiting for ${waitingFor.holderName || "another admin"}`
                    : editingId
                      ? "Save changes"
                      : "Add service"}
              </button>
              {editingId && (
                <button
                  className="customer-button customer-button-outline"
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="customer-panel admin-services__list-panel">
          <div className="customer-panel-header">
            <h2>Service menu</h2>
            <span>
              {availableCount} available · {archivedCount} archived
            </span>
          </div>
          <div
            className="admin-services__filters"
            role="group"
            aria-label="Filter services"
          >
            {[
              { value: "all", label: `All services (${services.length})` },
              { value: "available", label: `Available (${availableCount})` },
              { value: "archived", label: `Archived (${archivedCount})` },
            ].map((filter) => (
              <button
                className={`admin-services__filter${serviceFilter === filter.value ? " is-selected" : ""}`}
                type="button"
                key={filter.value}
                aria-pressed={serviceFilter === filter.value}
                onClick={() => setServiceFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {loading ? (
            <p role="status">Loading services…</p>
          ) : services.length === 0 ? (
            <p className="customer-empty-state">
              No services yet. Add your first service using the form above.
            </p>
          ) : filteredServices.length === 0 ? (
            <p className="customer-empty-state">
              No {serviceFilter} services to show.
            </p>
          ) : (
            <div className="admin-services__list">
              {filteredServices.map((service) => {
                const lock = locks[service._id];
                const isMine = editingId === service._id;
                const editors = lock?.editors || [];
                const first = editors[0];
                const othersEditing = editors.some((editor) => !editor.isMine);
                const lockedByOther = Boolean(first) && !first.isMine;
                const waitingCount = Math.max(editors.length - 1, 0);
                return (
                <article
                  className={`admin-services__item${service.isActive ? "" : " is-archived"}${lockedByOther ? " is-locked" : ""}`}
                  key={service._id}
                >
                  <div className="admin-services__details">
                    <div className="admin-services__title">
                      <h3>{service.name}</h3>
                      <span
                        className={`admin-services__status${service.isActive ? " is-active" : ""}`}
                      >
                        {service.isActive ? "Available" : "Archived"}
                      </span>
                      {isMine && !lockedByOther && (
                        <span className="admin-services__lock is-mine">
                          You are editing
                          {waitingCount > 0 && ` · ${waitingCount} waiting`}
                        </span>
                      )}
                      {lockedByOther && (
                        <span
                          className="admin-services__lock"
                          title={editors
                            .map(
                              (editor) =>
                                `${editor.position}. ${editor.isMine ? "You" : editor.holderName} (opened ${formatOpenedAt(editor.openedAt)})`,
                            )
                            .join("\n")}
                        >
                          {isMine
                            ? `You're #${lock.position} · waiting for ${first.holderName}`
                            : `Being edited by ${first.holderName} since ${formatOpenedAt(first.openedAt)}`}
                          {!isMine &&
                            waitingCount > 0 &&
                            ` · ${waitingCount} waiting`}
                        </span>
                      )}
                    </div>
                    <p>
                      {service.category || "Uncategorized"} ·{" "}
                      {service.durationMinutes} min · {formatPrice(service.price)}
                    </p>
                    {service.description && <p>{service.description}</p>}
                  </div>
                  <div className="admin-services__actions">
                    <button
                      className="customer-button customer-button-outline"
                      type="button"
                      onClick={() => beginEdit(service)}
                      disabled={isMine || openingId === service._id}
                    >
                      {openingId === service._id ? "Opening…" : "Edit"}
                    </button>
                    {service.isActive ? (
                      <button
                        className="customer-button admin-services__archive"
                        type="button"
                        onClick={() => archive(service)}
                        disabled={othersEditing}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="customer-button customer-button-primary"
                        type="button"
                        onClick={() => restore(service)}
                        disabled={othersEditing}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminServicesPage;
