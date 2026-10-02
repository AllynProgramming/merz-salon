import { Helmet } from "react-helmet-async";
import Navbar from "../components/landing/Navbar.jsx";
import Hero from "../components/landing/Hero.jsx";
import Features from "../components/landing/Features.jsx";
import HowItWorks from "../components/landing/HowItWorks.jsx";
import ServicesPreview from "../components/landing/ServicesPreview.jsx";
import DashboardPreview from "../components/landing/DashboardPreview.jsx";
import Feedback from "../components/landing/Feedback.jsx";
import FAQ from "../components/landing/FAQ.jsx";
import FinalCTA from "../components/landing/FinalCTA.jsx";
import Footer from "../components/landing/Footer.jsx";
import { faqData } from "../components/landing/landingContent.js";
import "../components/landing/landing.css";

const salonSchema = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  name: "[Salon Name]",
  url: "https://yourdomain.com",
  description:
    "Online salon booking and scheduling with real-time availability, reminders, and easy rescheduling.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "[Street]",
    addressLocality: "[City]",
    addressCountry: "PH",
  },
  potentialAction: {
    "@type": "ReserveAction",
    target: "https://yourdomain.com/book-appointment",
    name: "Book an appointment",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqData.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

function LandingPage() {
  return (
    <div className="salon-landing">
      <Helmet>
        <title>Online Salon Booking &amp; Scheduling | [Salon Name]</title>
        <meta
          name="description"
          content="Book your salon appointment online in minutes. Browse services and prices, pick a time slot, and get instant confirmation and reminders. Reserve your spot today."
        />
        <link rel="canonical" href="https://yourdomain.com/" />
        <meta
          property="og:title"
          content="Online Salon Booking &amp; Scheduling | [Salon Name]"
        />
        <meta
          property="og:description"
          content="Book your salon appointment online in minutes. Browse services and prices, pick a time slot, and get instant confirmation and reminders. Reserve your spot today."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://yourdomain.com/" />
        <meta
          property="og:image"
          content="https://yourdomain.com/og-image.jpg"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Online Salon Booking &amp; Scheduling | [Salon Name]"
        />
        <meta
          name="twitter:description"
          content="Book your salon appointment online in minutes. Browse services and prices, pick a time slot, and get instant confirmation and reminders. Reserve your spot today."
        />
        <meta
          name="twitter:image"
          content="https://yourdomain.com/og-image.jpg"
        />
        <script type="application/ld+json">
          {JSON.stringify(salonSchema)}
        </script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ServicesPreview />
        <DashboardPreview />
        <Feedback />
        <FAQ items={faqData} />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
