import { useState } from "react";

function FAQ({ items }) {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <section
      className="salon-section salon-faq"
      id="faq"
      aria-labelledby="salon-faq-title"
    >
      <div className="salon-container salon-faq-grid">
        <div className="salon-section-heading">
          <h2 id="salon-faq-title">FAQ</h2>
        </div>
        <div className="salon-faq-list">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            const answerId = `salon-faq-answer-${index}`;

            return (
              <article
                className={`salon-faq-item ${isOpen ? "is-open" : ""}`}
                key={item.question}
              >
                <h3>
                  <button
                    className="salon-faq-question"
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <span className="salon-faq-plus" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div
                  className="salon-faq-answer"
                  id={answerId}
                  hidden={!isOpen}
                >
                  <p>{item.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FAQ;
