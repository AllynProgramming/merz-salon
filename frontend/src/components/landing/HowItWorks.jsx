const steps = [
  "Create your account: Register in seconds and manage your profile.",
  "Choose a service: Browse descriptions, prices, and estimated durations.",
  "Pick a date and time: Select from available slots.",
  "Get confirmed: Receive your appointment details and reminders.",
];

function HowItWorks() {
  return (
    <section
      className="salon-section salon-process"
      id="how-it-works"
      aria-labelledby="salon-process-title"
    >
      <div className="salon-container salon-process-inner">
        <div className="salon-section-heading">
          <h2 id="salon-process-title">How It Works</h2>
        </div>
        <ol className="salon-step-list">
          {steps.map((step, index) => {
            const [label, description] = step.split(": ");
            return (
              <li className="salon-step" key={label}>
                <span className="salon-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <p>
                  <strong>{label}:</strong> {description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export default HowItWorks;
