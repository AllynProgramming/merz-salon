import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getServices } from "../../services/bookingApi.js";
import { fallbackServices } from "./landingContent.js";

function ServicesPreview() {
  const [services, setServices] = useState([]);
  const [state, setState] = useState("loading");
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadServices() {
      try {
        const data = await getServices({ limit: 4 });
        if (active) {
          setServices(data);
          setState(data.length ? "ready" : "empty");
        }
      } catch {
        if (active) {
          setServices(fallbackServices);
          setUsingFallback(true);
          setState("ready");
        }
      }
    }

    loadServices();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      className="salon-section salon-services"
      id="services"
      aria-labelledby="salon-services-title"
    >
      <div className="salon-container">
        <div className="salon-services-top">
          <div className="salon-section-heading">
            <p className="salon-kicker">Services</p>
            <h2 id="salon-services-title">Our Salon Services and Prices</h2>
          </div>
          <p className="salon-services-intro">
            Every service includes a clear description, price, and estimated
            duration so you can plan your visit with confidence. Found something
            you like? Book it online in just a few clicks.
          </p>
        </div>

        {state === "loading" && (
          <p className="salon-services-state" role="status">
            Loading services...
          </p>
        )}
        {state === "empty" && (
          <p className="salon-services-state" role="status">
            No services are available right now.
          </p>
        )}
        {state === "ready" && (
          <>
            {usingFallback && (
              <p className="salon-fallback-note" role="status">
                Service list unavailable. Showing sample services.
              </p>
            )}
            <div className="salon-service-list">
              {services.map((service, index) => (
                <article
                  className="salon-service"
                  key={service._id ?? service.name}
                >
                  <span className="salon-service-number" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div className="salon-service-copy">
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                  </div>
                  {typeof service.price === "number" && (
                    <p className="salon-service-price">
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(service.price)}
                    </p>
                  )}
                  <Link
                    className="salon-service-link"
                    to="/book-appointment"
                    aria-label={`Book ${service.name}`}
                  >
                    Book Now <span aria-hidden="true">↗</span>
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default ServicesPreview;
