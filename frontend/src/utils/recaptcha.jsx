import { useEffect, useRef, useState } from "react";

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
let scriptPromise;

const isRecaptchaConfigured = Boolean(siteKey);

function loadRecaptcha() {
  if (!isRecaptchaConfigured) return Promise.resolve(null);
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    document
      .querySelectorAll('script[src*="google.com/recaptcha/api.js"]')
      .forEach((script) => script.remove());
    window.grecaptcha = undefined;
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const startedAt = Date.now();
      const waitForRender = () => {
        if (window.grecaptcha?.render) {
          resolve(window.grecaptcha);
        } else if (Date.now() - startedAt > 5000) {
          reject(
            new Error("The reCAPTCHA checkbox could not be initialized."),
          );
        } else {
          window.setTimeout(waitForRender, 50);
        }
      };
      waitForRender();
    };
    script.onerror = () =>
      reject(new Error("The security check could not load. Please try again."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function RecaptchaWidget({ onChange }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isRecaptchaConfigured) {
      onChange(null);
      return undefined;
    }

    let active = true;
    loadRecaptcha()
      .then((recaptcha) => {
        if (!active || !recaptcha || !containerRef.current) return;
        widgetId.current = recaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            setError("");
            onChange(token);
          },
          "expired-callback": () => onChange(null),
          "error-callback": () => {
            setError("The security check could not be completed.");
            onChange(null);
          },
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
      onChange(null);
    };
  }, [onChange]);

  if (!isRecaptchaConfigured) return null;
  return (
    <div className="recaptcha-widget" aria-live="polite">
      <div ref={containerRef} />
      {error && <p className="recaptcha-error">{error}</p>}
    </div>
  );
}
