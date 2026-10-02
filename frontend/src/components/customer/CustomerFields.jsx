import { useState } from "react";

export function CustomerField({
  id,
  label,
  error,
  helper,
  required = false,
  children,
}) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldProps = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
  };

  return (
    <div className="customer-field">
      <label className="customer-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {typeof children === "function" ? children(fieldProps) : children}
      {helper && (
        <p className="customer-helper" id={helperId}>
          {helper}
        </p>
      )}
      {error && (
        <p className="customer-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function CustomerPasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <CustomerField id={id} label={label} error={error} required>
      {(fieldProps) => (
        <div className="customer-password-wrap">
          <input
            {...fieldProps}
            className="customer-input customer-password-input"
            type={visible ? "text" : "password"}
            name={id.replace(/^.*-/, "")}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            autoComplete={autoComplete}
            required
          />
          <button
            className="customer-password-toggle"
            type="button"
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </CustomerField>
  );
}
