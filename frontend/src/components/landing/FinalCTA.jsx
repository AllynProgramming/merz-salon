import { Link } from "react-router-dom";

function FinalCTA() {
  return (
    <section className="salon-final-cta" aria-label="Book an appointment">
      <div className="salon-container salon-final-cta-inner">
        <p>Book Your Salon Appointment Online, Anytime</p>
        <Link
          className="salon-button salon-button-light"
          to="/book-appointment"
        >
          Book Now
        </Link>
      </div>
    </section>
  );
}

export default FinalCTA;
