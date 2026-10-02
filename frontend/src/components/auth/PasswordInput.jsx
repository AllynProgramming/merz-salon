import { useState } from "react";
import FormField from "./FormField.jsx";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} error={error} required={required}>
      {(fieldProps) => (
        <div className="auth-password-wrap">
          <input
            {...fieldProps}
            className="auth-input auth-password-input"
            name={id.split("-").at(-1)}
            type={visible ? "text" : "password"}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            autoComplete={autoComplete}
            required={required}
          />
          <button
            className="auth-password-toggle"
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </FormField>
  );
}

export default PasswordInput;
