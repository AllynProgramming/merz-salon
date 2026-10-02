function DashboardPreview() {
  return (
    <section
      className="salon-section salon-dashboard"
      aria-labelledby="salon-dashboard-title"
    >
      <div className="salon-container salon-dashboard-grid">
        <div className="salon-dashboard-copy">
          <h2 id="salon-dashboard-title">Your Own Dashboard</h2>
          <p>
            View upcoming and past appointments, update your contact details,
            and manage your schedule in one place.
          </p>
        </div>
        <div
          className="salon-dashboard-art"
          aria-label="Dashboard preview showing upcoming and past appointments"
        >
          <div className="salon-dashboard-topline">
            <span>Upcoming appointments</span>
            <span className="salon-dashboard-mark" aria-hidden="true" />
          </div>
          <div className="salon-dashboard-appointment">
            <span className="salon-dashboard-date" aria-hidden="true">
              <b>13</b>
              <small>TUE</small>
            </span>
            <span className="salon-dashboard-line" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="salon-dashboard-confirmed">Confirmed</span>
          </div>
          <div className="salon-dashboard-past">
            Past appointments <span aria-hidden="true">···</span>
          </div>
          <div className="salon-dashboard-track" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}

export default DashboardPreview;
