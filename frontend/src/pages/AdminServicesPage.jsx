import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import { formatPrice } from "../components/booking/bookingUtils.js";
import {
  createService,
  getAdminServices,
  archiveService,
  restoreService,
  updateService,
} from "../services/bookingApi.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import "../styles/admin-services.css";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  durationMinutes: "",
  category: "",
};

function AdminServicesPage() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    getAdminServices(token)
      .then((items) => {
        if (active) setServices(items);
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

  const cancelEdit = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const beginEdit = (service) => {
    setEditingId(service._id);
    setForm({
      name: service.name,
      description: service.description || "",
      price: String(service.price),
      durationMinutes: String(service.durationMinutes),
      category: service.category || "",
    });
    setError("");
    setNotice("");
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
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      category: form.category.trim(),
    };

    try {
      if (editingId) {
        const { service } = await updateService(editingId, serviceData, token);
        setServices((current) =>
          current.map((item) => (item._id === editingId ? service : item)),
        );
        setNotice("Service updated.");
      } else {
        const { service } = await createService(serviceData, token);
        setServices((current) =>
          [...current, service].sort((first, second) =>
            first.name.localeCompare(second.name),
          ),
        );
        setNotice("Service added.");
      }
      cancelEdit();
    } catch (requestError) {
      setError(requestError.message || "Could not save this service.");
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
      if (editingId === service._id) cancelEdit();
      setNotice(
        `${service.name} was archived and is no longer available for booking.`,
      );
    } catch (requestError) {
      setError(requestError.message || "Could not archive this service.");
    }
  };

  const restore = async (service) => {
    setError("");
    setNotice("");
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
      setNotice(`${service.name} was restored to the service menu.`);
    } catch (requestError) {
      setError(requestError.message || "Could not restore this service.");
    }
  };

  return (
    <div className="customer-page salon-landing admin-services-page">
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
                required
              />
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
                disabled={saving}
              >
                {saving
                  ? "Saving…"
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
            <span>{services.filter((service) => service.isActive).length} active</span>
          </div>
          {loading ? (
            <p role="status">Loading services…</p>
          ) : services.length === 0 ? (
            <p className="customer-empty-state">
              No services yet. Add your first service using the form above.
            </p>
          ) : (
            <div className="admin-services__list">
              {services.map((service) => (
                <article
                  className={`admin-services__item${service.isActive ? "" : " is-archived"}`}
                  key={service._id}
                >
                  <div className="admin-services__details">
                    <div className="admin-services__title">
                      <h3>{service.name}</h3>
                      <span
                        className={`admin-services__status${service.isActive ? " is-active" : ""}`}
                      >
                        {service.isActive ? "Active" : "Archived"}
                      </span>
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
                    >
                      Edit
                    </button>
                    {service.isActive ? (
                      <button
                        className="customer-button admin-services__archive"
                        type="button"
                        onClick={() => archive(service)}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="customer-button customer-button-primary"
                        type="button"
                        onClick={() => restore(service)}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminServicesPage;
