import { Link } from "react-router-dom";
import "./auth.css";

function AuthLayout({ children, page = "login" }) {
  return (
    <main className={`auth-page auth-page-${page}`}>
      <div className="auth-shell">
        <section
          className="auth-form-panel"
          aria-label={
            page === "register" ? "Create a customer account" : "Account login"
          }
        >
          <Link
            className="auth-brand"
            to="/"
            aria-label="MERZ Beauty Salon home"
          >
            <span className="auth-brand-mark" aria-hidden="true">
              <img src="/logo-mark.png" alt="" />
            </span>
            <span>MERZ Beauty Salon</span>
          </Link>
          <div className="auth-form-content">{children}</div>
        </section>

        <aside
          className="auth-welcome-panel"
          aria-label="Salon booking benefits"
        >
          <div className="auth-welcome-copy">
            <p className="auth-welcome-label">MERZ Beauty Salon</p>
            <h2>Your next appointment is a few clicks away.</h2>
            <ul>
              <li>See real-time availability</li>
              <li>Reschedule in a few clicks</li>
              <li>Get appointment reminders</li>
            </ul>
          </div>
          <div className="auth-visual-calendar" aria-hidden="true">
            <div className="auth-calendar-top">
              <span>YOUR VISIT</span>
              <span className="auth-calendar-dot" />
            </div>
            <div className="auth-calendar-service">A little time for you</div>
            <div className="auth-calendar-slots">
              <i />
              <i />
              <i className="selected" />
            </div>
          </div>
          <span
            className="auth-welcome-orbit auth-orbit-one"
            aria-hidden="true"
          />
          <span
            className="auth-welcome-orbit auth-orbit-two"
            aria-hidden="true"
          />
        </aside>
      </div>
    </main>
  );
}

export default AuthLayout;
