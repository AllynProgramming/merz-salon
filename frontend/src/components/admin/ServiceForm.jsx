/**
 * The service fields, shared by the Add and Edit modals. The submit button
 * lives in the modal footer and points at this form with form={id}.
 */
function ServiceForm({ id, form, onChange, onSubmit, categories = [] }) {
  const update = (field) => (event) =>
    onChange({
      ...form,
      [field]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });

  return (
    <form id={id} className="admin-form" onSubmit={onSubmit}>
      <label className="admin-field admin-field--full">
        Service name
        <input
          name="name"
          value={form.name}
          onChange={update("name")}
          autoComplete="off"
          placeholder="e.g. Hair Rebond…"
          minLength="2"
          maxLength="120"
          required
          data-autofocus
        />
      </label>
      <label className="admin-field">
        Category
        <input
          name="category"
          value={form.category}
          onChange={update("category")}
          autoComplete="off"
          placeholder="e.g. Hair…"
          maxLength="60"
          list={categories.length ? `${id}-categories` : undefined}
        />
        {categories.length > 0 && (
          <datalist id={`${id}-categories`}>
            {categories.map((category) => (
              <option value={category} key={category} />
            ))}
          </datalist>
        )}
      </label>
      <label className="admin-field">
        Duration (minutes)
        <input
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          value={form.durationMinutes}
          onChange={update("durationMinutes")}
          autoComplete="off"
          placeholder="e.g. 60…"
          min="1"
          max="600"
          step="1"
          required
        />
      </label>
      <div className="admin-field">
        <label htmlFor={`${id}-price`}>Price</label>
        <div className="admin-field__prefix">
          <span aria-hidden="true">₱</span>
          <input
            id={`${id}-price`}
            name="price"
            type="number"
            inputMode="decimal"
            value={form.priceVaries ? "" : form.price}
            onChange={update("price")}
            autoComplete="off"
            placeholder={form.priceVaries ? "Varies" : "e.g. 500…"}
            min="0"
            step="0.01"
            disabled={form.priceVaries}
            required={!form.priceVaries}
          />
        </div>
      </div>
      <label className="admin-check admin-services__price-varies">
        <input
          name="priceVaries"
          type="checkbox"
          checked={form.priceVaries}
          onChange={update("priceVaries")}
        />
        Price varies (quoted at the salon)
      </label>
      <label className="admin-field admin-field--full">
        Description
        <textarea
          name="description"
          value={form.description}
          onChange={update("description")}
          autoComplete="off"
          placeholder="What the customer gets, how long it lasts…"
          maxLength="1000"
          rows="3"
        />
        <span className="admin-field__hint">
          {form.description.length}/1000 characters. Shown to customers when
          they book.
        </span>
      </label>
    </form>
  );
}

export default ServiceForm;
