const checks = [
  { id: "length", label: "8+ characters", test: (value) => value.length >= 8 },
  {
    id: "letter",
    label: "At least one letter",
    test: (value) => /[a-z]/i.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value) => /\d/.test(value),
  },
];

function PasswordStrength({ value }) {
  const complete = checks.filter((check) => check.test(value)).length;
  const level = !value
    ? "empty"
    : complete === 3
      ? "strong"
      : complete === 2
        ? "fair"
        : "low";

  return (
    <div className="auth-strength" aria-live="polite">
      <div className={`auth-strength-bar strength-${level}`} aria-hidden="true">
        <span style={{ width: `${(complete / checks.length) * 100}%` }} />
      </div>
      <p className="auth-strength-label">
        Password strength: {level === "empty" ? "not set" : level}
      </p>
      <ul className="auth-password-checks">
        {checks.map((check) => {
          const passed = check.test(value);
          return (
            <li className={passed ? "is-valid" : ""} key={check.id}>
              <span aria-hidden="true">{passed ? "✓" : "○"}</span>
              {check.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordStrength;
