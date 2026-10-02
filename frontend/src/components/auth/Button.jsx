function Button({
  loading = false,
  loadingText,
  children,
  className = "",
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`auth-submit ${className}`.trim()}
      disabled={loading || disabled}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="auth-spinner" aria-hidden="true" />}
      <span>{loading ? loadingText || "Please wait..." : children}</span>
    </button>
  );
}

export default Button;
