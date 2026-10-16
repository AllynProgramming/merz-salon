import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useAuth from "../context/useAuth.js";
import "../styles/customer.css";
import "../styles/admin-dashboard.css";
import "../styles/admin-reports.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatStatus = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

function dateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function AdminReportsPage() {
  const { token } = useAuth();
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return dateInputValue(date);
  });
  const [to, setTo] = useState(() => dateInputValue(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadReport() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ from, to });
        const response = await fetch(`/api/admin/reports?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(payload.message || "Could not load the report.");
        if (active) setReport(payload);
      } catch (requestError) {
        if (active)
          setError(requestError.message || "Could not load the report.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (token) loadReport();
    return () => {
      active = false;
    };
  }, [from, to, token]);

  const byStatus = report?.appointments?.byStatus || {};
  const statusEntries = Object.entries(byStatus).filter(
    ([, count]) => count > 0,
  );

  return (
    <div className="customer-page salon-landing admin-reports-page">
      <Helmet>
        <title>Reports | MERZ Beauty Salon</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="customer-container admin-dashboard">
        <header className="customer-page-heading admin-dashboard__heading">
          <div>
            <p className="customer-eyebrow">Salon operations</p>
            <h1>Reports</h1>
            <p className="customer-lede">
              A clear view of appointments, services, and the customers you are
              serving.
            </p>
          </div>
          <Link className="customer-button customer-button-outline" to="/admin">
            Back to dashboard
          </Link>
        </header>

        <section className="admin-reports__period" aria-label="Report period">
          <label>
            <span>From</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={to}
              min={from}
              max={dateInputValue(new Date())}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          {report && (
            <p>
              Showing {report.period.from} to {report.period.to}
            </p>
          )}
        </section>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="customer-panel admin-reports__loading" role="status">
            Preparing your report...
          </div>
        ) : report ? (
          <>
            <section
              className="admin-reports__hero"
              aria-label="Appointment summary"
            >
              <div>
                <p className="customer-eyebrow">Appointments in this period</p>
                <strong>{report.appointments.total}</strong>
              </div>
              <div className="admin-reports__status-list">
                {statusEntries.map(([status, count]) => (
                  <div key={status}>
                    <span>{formatStatus(status)}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </section>
            <div className="admin-reports__grid">
              <section
                className="customer-panel admin-dashboard__panel"
                aria-labelledby="services-report-title"
              >
                <div className="customer-panel-header admin-dashboard__panel-header">
                  <h2 id="services-report-title">Services</h2>
                  <span>Most booked first</span>
                </div>
                {report.services.length ? (
                  <div className="admin-reports__table">
                    {report.services.map((service) => (
                      <div className="admin-reports__row" key={service._id}>
                        <div>
                          <strong>{service.name}</strong>
                          <span>
                            {service.appointments} bookings ·{" "}
                            {service.completed} completed
                          </span>
                        </div>
                        <div>
                          <strong>{formatCurrency(service.revenue)}</strong>
                          <span>
                            {service.ratingCount
                              ? `${service.averageRating.toFixed(1)} / 5 rating`
                              : "No ratings yet"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="customer-empty-state">
                    No appointments in this period.
                  </p>
                )}
              </section>
              <section
                className="customer-panel admin-dashboard__panel"
                aria-labelledby="customers-report-title"
              >
                <div className="customer-panel-header admin-dashboard__panel-header">
                  <h2 id="customers-report-title">Customers</h2>
                  <span>{report.customers.total} total accounts</span>
                </div>
                <p className="admin-reports__customer-count">
                  <strong>{report.customers.activeInPeriod}</strong> customers
                  visited during this period.
                </p>
                <div className="admin-reports__table">
                  {report.customers.frequent.map((customer) => (
                    <div className="admin-reports__row" key={customer._id}>
                      <div>
                        <strong>{customer.name?.trim() || "Customer"}</strong>
                        <span>Customer visits</span>
                      </div>
                      <strong>{customer.visits}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default AdminReportsPage;
