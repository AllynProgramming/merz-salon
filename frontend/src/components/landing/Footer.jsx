import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="salon-footer">
      <div className="salon-container salon-footer-inner">
        <div className="salon-footer-address">
          <p className="salon-footer-brand">MERZ Beauty Salon</p>
          <address>
            Corner Grema Subdivision, Malaybalay City, 8700 Bukidnon,
            Philippines
          </address>
          <a href="https://merzbeauty.com">merzbeauty.com</a>
        </div>
        <nav className="salon-footer-links" aria-label="Footer navigation">
          <Link to="/services">Services</Link>
          <Link to="/book-appointment">Book Appointment</Link>
          <Link to="/login">Log In</Link>
          <Link to="/register">Register</Link>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
