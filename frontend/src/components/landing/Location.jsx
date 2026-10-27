import { useEffect, useState } from "react";

const salonAddress =
  "Corner Grema Subdivision, Malaybalay City, 8700 Bukidnon, Philippines";
const salonCoordinates = "8.144501542477304, 125.12416303720529";
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  salonAddress,
)}`;

function Location() {
  const [embeddedMaps, setEmbeddedMaps] = useState(true);

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setEmbeddedMaps(payload.embeddedMaps !== false);
      })
      .catch((error) =>
        console.warn("Could not load public map settings:", error.message),
      );
  }, []);

  return (
    <section
      className="salon-section salon-location"
      aria-labelledby="salon-location-title"
    >
      <div className="salon-container salon-location-grid">
        <div className="salon-location-copy">
          <p className="salon-location-kicker">Come by</p>
          <h2 id="salon-location-title">Find your way to MERZ.</h2>
          <p>
            Settle in at the corner of Grema Subdivision in Malaybalay City. We
            will be ready when you are.
          </p>
          <address>{salonAddress}</address>
          <a
            className="salon-location-directions"
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Get directions
          </a>
        </div>
        {embeddedMaps && (
          <div className="salon-location-map">
            <iframe
              title="Map showing MERZ Beauty Salon in Malaybalay City"
              src={`https://www.google.com/maps?q=${salonCoordinates}&z=18&output=embed`}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default Location;
