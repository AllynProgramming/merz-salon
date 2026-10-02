function Feedback() {
  return (
    <section
      className="salon-section salon-feedback"
      aria-labelledby="salon-feedback-title"
    >
      <div className="salon-container salon-feedback-inner">
        <div>
          <h2 id="salon-feedback-title">Your Feedback Matters</h2>
          <p>
            After your visit, rate your service and share your experience to
            help us keep improving.
          </p>
        </div>
        <div className="salon-rating" aria-label="Five star rating">
          <span aria-hidden="true">★★★★★</span>
          <span className="salon-rating-rule" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

export default Feedback;
