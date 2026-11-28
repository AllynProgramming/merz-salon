import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "../components/landing/Navbar.jsx";
import {
  EmptyState,
  ServiceCard,
  ServiceFilters,
  Skeleton,
} from "../components/booking/BookingComponents.jsx";
import ServiceDetailsModal from "../components/booking/ServiceDetailsModal.jsx";
import { getServices } from "../services/bookingApi.js";
import "../styles/booking.css";

const OTHER = "Other services";
const categoryOf = (service) => service.category || OTHER;

// Services with a "Price varies" (null) price sort after priced ones.
const priceOf = (service) =>
  service.price == null ? Number.POSITIVE_INFINITY : Number(service.price);

const sorters = {
  name: (first, second) => first.name.localeCompare(second.name),
  popular: (first, second) =>
    Number(second.ratingCount || 0) - Number(first.ratingCount || 0) ||
    Number(second.averageRating || 0) - Number(first.averageRating || 0) ||
    first.name.localeCompare(second.name),
  "price-asc": (first, second) => priceOf(first) - priceOf(second),
  "price-desc": (first, second) =>
    (second.price == null ? -1 : second.price) -
    (first.price == null ? -1 : first.price),
  duration: (first, second) => first.durationMinutes - second.durationMinutes,
};

function ServicesPage() {
  const [services, setServices] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let active = true;
    getServices()
      .then((result) => {
        if (active) setServices(result);
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "We couldn't load services.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const categories = useMemo(
    () => [...new Set(services.map(categoryOf))].sort(),
    [services],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (service) =>
    !normalizedSearch ||
    `${service.name} ${service.description || ""} ${service.category || ""}`
      .toLowerCase()
      .includes(normalizedSearch);

  // Chip counts follow the search, so customers see where matches are.
  const searched = services.filter(matchesSearch);
  const counts = searched.reduce(
    (totals, service) => {
      const key = categoryOf(service);
      totals[key] = (totals[key] || 0) + 1;
      return totals;
    },
    { All: searched.length },
  );

  const visibleServices = searched
    .filter((service) => category === "All" || categoryOf(service) === category)
    .sort(sorters[sort] || sorters.name);

  // With "All" selected, show the menu in category sections.
  const sections =
    category === "All"
      ? categories
          .map((name) => ({
            name,
            items: visibleServices.filter((service) => categoryOf(service) === name),
          }))
          .filter((section) => section.items.length)
      : [{ name: category, items: visibleServices }];

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
  };

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Salon Services &amp; Prices | MERZ Beauty Salon</title>
      </Helmet>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Service menu</p>
            <h1>Salon Services &amp; Prices</h1>
            <p className="booking-lede">
              Browse the menu, compare prices and times, then book the service
              you want in a few taps.
            </p>
          </div>
        </header>

        <div className="booking-filters-bar">
          <ServiceFilters
            categories={categories}
            counts={loading ? null : counts}
            category={category}
            onCategory={setCategory}
            search={search}
            onSearch={setSearch}
            sort={sort}
            onSort={setSort}
          />
        </div>

        {loading ? (
          <Skeleton count={6} />
        ) : error ? (
          <div className="booking-state booking-state-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : visibleServices.length ? (
          <>
            <p className="booking-results-summary" aria-live="polite">
              {visibleServices.length}{" "}
              {visibleServices.length === 1 ? "service" : "services"}
              {normalizedSearch ? ` matching “${search.trim()}”` : ""}
              {category !== "All" ? ` in ${category}` : ""}
              {(normalizedSearch || category !== "All") && (
                <button type="button" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </p>
            {sections.map((section) => (
              <section
                className="booking-service-section"
                {...(category === "All"
                  ? { "aria-labelledby": `services-${section.name}` }
                  : { "aria-label": `${section.name} services` })}
                key={section.name}
              >
                {category === "All" && (
                  <h2
                    className="booking-service-section-title"
                    id={`services-${section.name}`}
                  >
                    {section.name}
                    <span>
                      {section.items.length}{" "}
                      {section.items.length === 1 ? "service" : "services"}
                    </span>
                  </h2>
                )}
                <div className="booking-service-grid">
                  {section.items.map((service) => (
                    <ServiceCard
                      service={service}
                      onShowDetails={setDetails}
                      key={service._id}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <EmptyState
            title="No services match your search"
            message="Try another word, or clear the filters to see the full menu."
            action="Clear filters"
            onAction={clearFilters}
          />
        )}
      </main>
      {details && (
        <ServiceDetailsModal service={details} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}

export default ServicesPage;
