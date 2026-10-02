import LandingIcon from "./LandingIcon.jsx";

const features = [
  {
    title: "Real-time availability",
    description:
      "See open and taken time slots instantly, so there are no double bookings.",
    icon: "availability",
  },
  {
    title: "Easy rescheduling and cancellation",
    description: "Change your appointment date and time in a few clicks.",
    icon: "reschedule",
  },
  {
    title: "Automatic reminders",
    description:
      "Get notifications for confirmed bookings, upcoming appointments, and changes.",
    icon: "reminders",
  },
  {
    title: "Track your booking",
    description:
      "See whether your appointment is pending, confirmed, completed, or cancelled.",
    icon: "status",
  },
];

function Features() {
  return (
    <section
      className="salon-section salon-features"
      aria-labelledby="salon-features-title"
    >
      <div className="salon-container">
        <div className="salon-section-heading">
          <h2 id="salon-features-title">Why Book With MERZ Beauty Salon?</h2>
        </div>
        <div className="salon-feature-list">
          {features.map((feature) => (
            <article className="salon-feature" key={feature.title}>
              <span className="salon-feature-icon">
                <LandingIcon name={feature.icon} />
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
