import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "../components/landing/Navbar.jsx";
import {
  EmptyState,
  ServiceCard,
  ServiceFilters,
  Skeleton,
} from "../components/booking/BookingComponents.jsx";
import { getServices } from "../services/bookingApi.js";
import "../styles/booking.css";

function ServicesPage() {
  const [services, setServices] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

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

  const categories = [
    ...new Set(services.map((service) => service.category).filter(Boolean)),
  ].sort();
  const normalizedSearch = search.trim().toLowerCase();
  const visibleServices = services
    .filter((service) => category === "All" || service.category === category)
    .filter(
      (service) =>
        !normalizedSearch ||
        `${service.name} ${service.description} ${service.category}`
          .toLowerCase()
          .includes(normalizedSearch),
    )
    .sort((first, second) => {
      if (sort === "price-asc") return first.price - second.price;
      if (sort === "price-desc") return second.price - first.price;
      if (sort === "duration")
        return first.durationMinutes - second.durationMinutes;
      return first.name.localeCompare(second.name);
    });

  return (
    <div className="booking-page salon-landing">
      <Helmet>
        <title>Salon Services &amp; Prices | MERZ Beauty Salon</title>
      </Helmet>
      <Navbar />
      <main className="booking-container">
        <header className="booking-header">
          <div>
            <p className="booking-eyebrow">Service menu</p>
            <h1>Salon Services &amp; Prices</h1>
            <p className="booking-lede">
              Choose a service and see its price and estimated time before you
              book.
            </p>
          </div>
        </header>

        <ServiceFilters
          categories={categories}
          category={category}
          onCategory={setCategory}
          search={search}
          onSearch={setSearch}
          sort={sort}
          onSort={setSort}
        />

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
          <div className="booking-service-grid">
            {visibleServices.map((service) => (
              <ServiceCard service={service} key={service._id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No services match your search"
            message="Clear your search or choose another category to see the full menu."
            action="Clear filters"
            onAction={() => {
              setSearch("");
              setCategory("All");
            }}
          />
        )}
      </main>
    </div>
  );
}

export default ServicesPage;
