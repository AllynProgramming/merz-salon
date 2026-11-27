import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
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
import Modal from "../components/admin/ui/Modal.jsx";
import useConfirm from "../components/admin/ui/useConfirm.jsx";
import { toast } from "../components/admin/ui/toast.js";
import ServiceForm from "../components/admin/ServiceForm.jsx";
import {
  emptyServiceForm,
  isServiceFormDirty,
  toServiceForm,
  toServicePayload,
} from "../components/admin/serviceFormValues.js";
import "../styles/admin-services.css";

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

const filters = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "archived", label: "Archived" },
];

function AdminServicesPage() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [locks, setLocks] = useState({});
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  // The open modal: null, { mode: "add" } or { mode: "edit", serviceId }.
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyServiceForm);
  const [initialForm, setInitialForm] = useState(emptyServiceForm);
  const [lockToken, setLockToken] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  const editingId = modal?.mode === "edit" ? modal.serviceId : "";

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
          setLoadError(requestError.message || "Could not load salon services.");
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

  const myLock = editingId ? locks[editingId] : null;
  const myPosition = myLock?.position ?? 1;
  const waitingFor = editingId && myPosition > 1 ? myLock?.editors?.[0] : null;

  // Tell the admin when the one ahead of them finishes.
  const previousWaitingForRef = useRef(null);
  useEffect(() => {
    const previous = previousWaitingForRef.current;
    if (previous && !waitingFor && editingId) {
      setModalNotice(
        `${previous.holderName || "The other admin"} finished. You can save your changes now.`,
      );
    }
    previousWaitingForRef.current = waitingFor;
  }, [waitingFor, editingId]);

  const closeModal = useCallback(() => {
    const { serviceId, lockToken: currentToken } = editSessionRef.current;
    if (serviceId && currentToken) {
      releaseServiceEditLock(serviceId, token, currentToken).then(refreshLocks);
    }
    setModal(null);
    setLockToken("");
    setModalError("");
    setModalNotice("");
  }, [token, refreshLocks]);

  // Escape, backdrop click, the X and Cancel all land here.
  const requestClose = async () => {
    if (saving) return;
    if (
      isServiceFormDirty(form, initialForm) &&
      !(await confirm({
        title: "Discard your changes?",
        description: "The changes you made to this service haven't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
      }))
    ) {
      return;
    }
    closeModal();
  };

  const loseLock = useCallback(
    (message) => {
      closeModal();
      toast.error(message);
    },
    [closeModal],
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

  const openAdd = () => {
    setForm(emptyServiceForm);
    setInitialForm(emptyServiceForm);
    setModalError("");
    setModalNotice("");
    setModal({ mode: "add" });
  };

  const openEdit = async (service) => {
    // The button stays enabled (and focused) while opening, so the modal can
    // return focus to it on close; ignore repeat clicks instead.
    if (openingId) return;
    setOpeningId(service._id);
    try {
      const { token: newLockToken, lock } = await lockServiceForEdit(
        service._id,
        token,
      );
      const values = toServiceForm(service);
      setLockToken(newLockToken);
      setLocks((current) => ({ ...current, [service._id]: lock }));
      setForm(values);
      setInitialForm(values);
      setModalError("");
      setModalNotice("");
      setModal({ mode: "edit", serviceId: service._id });
    } catch (requestError) {
      toast.error(
        requestError.message || "Could not open this service for editing.",
      );
    } finally {
      setOpeningId("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || waitingFor) return;
    setSaving(true);
    setModalError("");
    const serviceData = toServicePayload(form);

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
        setLockToken("");
        setModal(null);
        toast.success(`${service.name} was updated.`);
      } else {
        const { service } = await createService(serviceData, token);
        setServices((current) =>
          [...current, service].sort((first, second) =>
            first.name.localeCompare(second.name),
          ),
        );
        setModal(null);
        toast.success(`${service.name} was added to the service menu.`);
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
        setForm(toServiceForm(latest));
        setInitialForm(toServiceForm(latest));
        setModalNotice("");
        setModalError(requestError.message);
      } else if (editingId && code === "SERVICE_LOCKED") {
        // Still behind another admin: keep the form and the typed changes.
        if (requestError.details.lock) {
          setLocks((current) => ({
            ...current,
            [editingId]: requestError.details.lock,
          }));
        }
        setModalError(requestError.message);
      } else if (editingId && isLockConflict(requestError)) {
        loseLock(requestError.message);
      } else {
        setModalError(requestError.message || "Could not save this service.");
      }
    } finally {
      setSaving(false);
    }
  };

  const archive = async (service) => {
    const confirmed = await confirm({
      title: `Archive ${service.name}?`,
      description:
        "Customers won't be able to book it. Existing appointments stay as they are, and you can restore it at any time.",
      confirmLabel: "Archive service",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const { service: archivedService } = await archiveService(
        service._id,
        token,
      );
      setServices((current) =>
        current.map((item) =>
          item._id === archivedService._id ? archivedService : item,
        ),
      );
      toast.success(`${service.name} was archived and is hidden from booking.`);
    } catch (requestError) {
      toast.error(requestError.message || "Could not archive this service.");
      if (isLockConflict(requestError)) refreshLocks();
    }
  };

  const restore = async (service) => {
    try {
      const { service: restoredService } = await restoreService(
        service._id,
        token,
      );
      setServices((current) =>
        current.map((item) =>
          item._id === restoredService._id ? restoredService : item,
        ),
      );
      toast.success(`${service.name} is back on the service menu.`);
    } catch (requestError) {
      toast.error(requestError.message || "Could not restore this service.");
      if (isLockConflict(requestError)) refreshLocks();
    }
  };

  const availableCount = services.filter((service) => service.isActive).length;
  const archivedCount = services.length - availableCount;
  const counts = {
    all: services.length,
    available: availableCount,
    archived: archivedCount,
  };
  const categories = useMemo(
    () =>
      [...new Set(services.map((service) => service.category).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second)),
    [services],
  );
  const query = search.trim().toLocaleLowerCase();
  const filteredServices = services.filter((service) => {
    if (serviceFilter === "available" && !service.isActive) return false;
    if (serviceFilter === "archived" && service.isActive) return false;
    if (!query) return true;
    return [service.name, service.category, service.description]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
  const editingService = services.find((service) => service._id === editingId);

  return (
    <div className="customer-page salon-landing admin-services-page">
      <AdminNavigation />
      <Helmet>
        <title>Manage Services | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main id="admin-main" tabIndex={-1} className="customer-container admin-services">
        <header className="customer-page-heading admin-section-heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Manage Services</h1>
            <p className="customer-lede">
              Add services to your menu or update their details and availability.
            </p>
          </div>
          <button
            className="customer-button customer-button-primary admin-services__add"
            type="button"
            onClick={openAdd}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add service
          </button>
        </header>

        {loadError && (
          <div className="customer-alert customer-alert-error" role="alert">
            {loadError} Refresh the page to try again.
          </div>
        )}

        <section
          className="customer-panel admin-services__list-panel"
          aria-labelledby="admin-services-menu-heading"
        >
          <div className="admin-services__toolbar">
            <div>
              <h2 id="admin-services-menu-heading">Service menu</h2>
              <p className="admin-services__summary admin-tabular">
                {availableCount} available · {archivedCount} archived
              </p>
            </div>
            <label className="admin-services__search">
              <span className="admin-dashboard__visually-hidden">
                Search services
              </span>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                name="service-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <div
            className="admin-services__filters"
            role="group"
            aria-label="Filter services"
          >
            {filters.map((filter) => (
              <button
                className={`admin-services__filter${serviceFilter === filter.value ? " is-selected" : ""}`}
                type="button"
                key={filter.value}
                aria-pressed={serviceFilter === filter.value}
                onClick={() => setServiceFilter(filter.value)}
              >
                {filter.label}
                <span className="admin-services__filter-count admin-tabular">
                  {counts[filter.value]}
                </span>
              </button>
            ))}
          </div>
          {loading ? (
            <div className="admin-services__list" aria-busy="true">
              <p className="admin-dashboard__visually-hidden" role="status">
                Loading services…
              </p>
              {[0, 1, 2, 3].map((item) => (
                <div className="admin-services__item admin-services__skeleton" key={item}>
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="admin-services__empty">
              <p>No services yet.</p>
              <button
                className="customer-button customer-button-primary"
                type="button"
                onClick={openAdd}
              >
                Add your first service
              </button>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="admin-services__empty">
              <p>
                {query
                  ? `No ${serviceFilter === "all" ? "" : `${serviceFilter} `}services match “${search.trim()}”.`
                  : `No ${serviceFilter} services to show.`}
              </p>
              {query && (
                <button
                  className="customer-button customer-button-outline"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <ul className="admin-services__list">
              {filteredServices.map((service) => {
                const lock = locks[service._id];
                const isMine = editingId === service._id;
                const editors = lock?.editors || [];
                const first = editors[0];
                const othersEditing = editors.some((editor) => !editor.isMine);
                const lockedByOther = Boolean(first) && !first.isMine;
                const waitingCount = Math.max(editors.length - 1, 0);
                return (
                  <li
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
                      <p className="admin-services__meta admin-tabular">
                        <span>{service.category || "Uncategorized"}</span>
                        <span>{service.durationMinutes}&nbsp;min</span>
                        <span>{formatPrice(service.price)}</span>
                      </p>
                      {service.description && (
                        <p className="admin-services__description-text">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <div className="admin-services__actions">
                      <button
                        className="customer-button customer-button-outline"
                        type="button"
                        onClick={() => openEdit(service)}
                        aria-busy={openingId === service._id || undefined}
                        aria-label={`Edit ${service.name}`}
                      >
                        {openingId === service._id ? (
                          <>
                            <span className="admin-spinner" aria-hidden="true" />
                            Opening…
                          </>
                        ) : (
                          "Edit"
                        )}
                      </button>
                      {service.isActive ? (
                        <button
                          className="customer-button admin-services__archive"
                          type="button"
                          onClick={() => archive(service)}
                          disabled={othersEditing}
                          aria-label={`Archive ${service.name}`}
                          title={
                            othersEditing
                              ? "Another admin is editing this service."
                              : undefined
                          }
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          className="customer-button customer-button-primary"
                          type="button"
                          onClick={() => restore(service)}
                          disabled={othersEditing}
                          aria-label={`Restore ${service.name}`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {modal && (
        <Modal onClose={requestClose} size="wide">
          <Modal.Header>
            <div>
              <Modal.Eyebrow>
                {modal.mode === "edit" ? "Edit service" : "New service"}
              </Modal.Eyebrow>
              <Modal.Title>
                {modal.mode === "edit"
                  ? editingService?.name || "Edit service"
                  : "Add a service"}
              </Modal.Title>
              <Modal.Description>
                {modal.mode === "edit"
                  ? "Changes apply to new bookings as soon as you save."
                  : "New services appear on the booking menu right away."}
              </Modal.Description>
            </div>
            <Modal.Close label="Close without saving" />
          </Modal.Header>
          <Modal.Body>
            {waitingFor && (
              <p className="admin-note admin-note--warning" role="status">
                {waitingFor.holderName || "Another admin"} opened this service
                at {formatOpenedAt(waitingFor.openedAt)} and takes precedence.
                You can keep making changes. Save unlocks when they finish.
              </p>
            )}
            {modalNotice && !waitingFor && (
              <p className="admin-note" role="status">
                {modalNotice}
              </p>
            )}
            {modalError && (
              <p className="admin-note admin-note--error" role="alert">
                {modalError}
              </p>
            )}
            <ServiceForm
              id="service-form"
              form={form}
              onChange={(next) => {
                setForm(next);
                setModalError("");
              }}
              onSubmit={submit}
              categories={categories}
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
              form="service-form"
              disabled={saving || Boolean(waitingFor)}
            >
              {saving ? (
                <>
                  <span className="admin-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : waitingFor ? (
                `Waiting for ${waitingFor.holderName || "another admin"}`
              ) : modal.mode === "edit" ? (
                "Save changes"
              ) : (
                "Add service"
              )}
            </button>
          </Modal.Footer>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

export default AdminServicesPage;
