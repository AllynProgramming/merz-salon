import { Link } from "react-router-dom";
import Modal from "../ui/Modal.jsx";
import { ServiceDuration, ServiceRating } from "./BookingComponents.jsx";
import { formatPrice, isMostLoved } from "./bookingUtils.js";
import "../../styles/booking.css";

/** Everything about one service, with a button to book it. */
function ServiceDetailsModal({ service, onClose }) {
  return (
    <Modal onClose={onClose} className="booking-scope booking-service-modal">
      <Modal.Header>
        <div>
          <Modal.Eyebrow>
            {service.category || "Service"}
            {isMostLoved(service) && " · Most loved"}
          </Modal.Eyebrow>
          <Modal.Title>{service.name}</Modal.Title>
        </div>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <dl className="booking-service-details">
          <div>
            <dt>Price</dt>
            <dd>{formatPrice(service.price)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              <ServiceDuration minutes={service.durationMinutes} />
            </dd>
          </div>
          <div>
            <dt>Rating</dt>
            <dd>
              <ServiceRating service={service} />
            </dd>
          </div>
        </dl>
        <p className="booking-service-details-copy">
          {service.description ||
            "Ask the salon team for details about this service."}
        </p>
        {service.price == null && (
          <p className="ui-note">
            The price for this service varies. The salon confirms it with you
            before your visit.
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button
          className="customer-button customer-button-outline"
          type="button"
          onClick={onClose}
        >
          Keep Browsing
        </button>
        <Link
          className="customer-button customer-button-primary"
          to={`/book-appointment?service=${encodeURIComponent(service._id)}`}
          data-autofocus
        >
          Book This Service
        </Link>
      </Modal.Footer>
    </Modal>
  );
}

export default ServiceDetailsModal;
