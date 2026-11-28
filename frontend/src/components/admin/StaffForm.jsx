import { staffRoleOptions } from "./staffRoles.js";

/**
 * Team member fields, shared by the Add and Edit modals. The submit button
 * lives in the modal footer and points at this form with form={id}.
 */
function StaffForm({ id, form, onChange, onSubmit }) {
  const update = (field) => (event) =>
    onChange({ ...form, [field]: event.target.value });

  return (
    <form id={id} className="ui-form" onSubmit={onSubmit}>
      <label className="ui-field ui-field--full">
        Full name
        <input
          name="name"
          value={form.name}
          onChange={update("name")}
          autoComplete="off"
          placeholder="e.g. Maria Santos…"
          minLength="2"
          maxLength="120"
          required
          data-autofocus
        />
      </label>
      <label className="ui-field">
        Email address
        <input
          name="email"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={update("email")}
          autoComplete="off"
          spellCheck={false}
          placeholder="name@example.com"
          maxLength="254"
          required
        />
        <span className="ui-field__hint">Used to sign in.</span>
      </label>
      <label className="ui-field">
        Phone number
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={update("phone")}
          autoComplete="off"
          placeholder="e.g. 0917 123 4567…"
          minLength="7"
          maxLength="30"
          required
        />
      </label>
      <fieldset className="ui-field ui-field--full admin-staff__roles">
        <legend>Access level</legend>
        {staffRoleOptions.map((option) => (
          <label
            className={`admin-staff__role-option${form.role === option.value ? " is-selected" : ""}`}
            key={option.value}
          >
            <input
              type="radio"
              name={`${id}-role`}
              value={option.value}
              checked={form.role === option.value}
              onChange={update("role")}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </form>
  );
}

export default StaffForm;
