function FormField({ id, label, helper, error, required = false, children }) {
  const helperId = helper ? `${id}-helper` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldProps = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
  };

  return (
    <div className={`auth-field ${error ? "has-error" : ""}`}>
      <label className="auth-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {typeof children === "function" ? children(fieldProps) : children}
      {helper && (
        <p className="auth-helper" id={helperId}>
          {helper}
        </p>
      )}
      {error && (
        <p className="auth-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
