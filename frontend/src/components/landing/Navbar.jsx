import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import LandingIcon from "./LandingIcon.jsx";
import UserMenu from "../auth/UserMenu.jsx";
import useAuth from "../../context/useAuth.js";
import Toaster from "../ui/Toaster.jsx";

function Navbar() {
  const location = useLocation();
  const { user, isRestoring } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const sectionPath = (section) =>
    location.pathname === "/" ? `#${section}` : `/#${section}`;

  return (
    <header className="salon-nav">
      <a className="ui-skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="salon-container salon-nav-inner">
        <Link
          className="salon-brand"
          to="/"
          aria-label="MERZ Beauty Salon home"
          onClick={closeMenu}
        >
          <span className="salon-brand-mark" aria-hidden="true">
            <img src="/logo-mark.png" alt="" width="40" height="40" />
          </span>
          <span>MERZ Beauty Salon</span>
        </Link>

        <button
          className="salon-menu-toggle"
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          aria-controls="salon-main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <LandingIcon name={menuOpen ? "close" : "menu"} />
        </button>

        <nav
          id="salon-main-navigation"
          className={`salon-menu ${menuOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          <NavLink
            to="/services"
            className={({ isActive }) => (isActive ? "is-active" : "")}
            onClick={closeMenu}
          >
            Services
          </NavLink>
          <NavLink
            to="/book-appointment"
            className={({ isActive }) => (isActive ? "is-active" : "")}
            onClick={closeMenu}
          >
            Book Appointment
          </NavLink>
          <a href={sectionPath("how-it-works")} onClick={closeMenu}>
            How It Works
          </a>
          <a href={sectionPath("faq")} onClick={closeMenu}>
            FAQ
          </a>
          <div className="salon-menu-actions">
            {!isRestoring &&
              (user ? (
                <UserMenu />
              ) : (
                <>
                  <Link
                    className="salon-button salon-button-quiet"
                    to="/login"
                    onClick={closeMenu}
                  >
                    Log In
                  </Link>
                  <Link
                    className="salon-button salon-button-primary"
                    to="/register"
                    onClick={closeMenu}
                  >
                    Register
                  </Link>
                </>
              ))}
          </div>
        </nav>
      </div>
      <Toaster />
    </header>
  );
}

export default Navbar;
