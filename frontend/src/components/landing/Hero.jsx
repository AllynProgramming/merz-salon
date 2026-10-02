import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="salon-hero">
      <div className="salon-container salon-hero-grid">
        <div className="salon-hero-copy">
          <h1>Book Your Salon Appointment Online, Anytime</h1>
          <p className="salon-hero-lede">
            Skip the phone calls and waiting. Choose your service, pick an
            available time, and get instant confirmation.
          </p>
          <div className="salon-hero-actions">
            <Link
              className="salon-button salon-button-primary"
              to="/book-appointment"
            >
              Book Now
            </Link>
            <Link className="salon-button salon-button-outline" to="/services">
              View Services
            </Link>
          </div>
          <p className="salon-keyphrase">
            Online salon appointment booking, with salon appointment reminders.
          </p>
        </div>

        <div
          className="salon-slot-art"
          aria-label="Appointment availability preview"
        >
          <div className="salon-slot-heading">
            <span className="salon-slot-day">Choose a time</span>
            <span className="salon-open-indicator">
              <span /> Available
            </span>
          </div>
          <div className="salon-slot-week" aria-hidden="true">
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
          </div>
          <div className="salon-slot-days" aria-hidden="true">
            <span>12</span>
            <span className="is-selected">13</span>
            <span>14</span>
            <span>15</span>
            <span>16</span>
          </div>
          <div className="salon-slot-rule" />
          <div className="salon-time-list">
            <span>9:00 AM</span>
            <span className="is-selected">10:30 AM</span>
            <span>1:00 PM</span>
          </div>
          <div className="salon-slot-foot">
            <span>Real-time availability</span>
            <span className="salon-slot-dot" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="salon-hero-edge" aria-hidden="true" />
    </section>
  );
}

export default Hero;
