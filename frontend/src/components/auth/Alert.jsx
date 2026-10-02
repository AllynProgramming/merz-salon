function Alert({ variant = "error", children }) {
  if (!children) return null;

  return (
    <div
      className={`auth-alert auth-alert-${variant}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

export default Alert;
