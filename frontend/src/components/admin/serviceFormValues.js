export const emptyServiceForm = {
  name: "",
  description: "",
  price: "",
  priceVaries: false,
  durationMinutes: "",
  category: "",
};

export const toServiceForm = (service) => ({
  name: service.name,
  description: service.description || "",
  price: service.price == null ? "" : String(service.price),
  priceVaries: service.price == null,
  durationMinutes: String(service.durationMinutes),
  category: service.category || "",
});

export const toServicePayload = (form) => ({
  name: form.name.trim(),
  description: form.description.trim(),
  price: form.priceVaries ? null : Number(form.price),
  durationMinutes: Number(form.durationMinutes),
  category: form.category.trim(),
});

export const isServiceFormDirty = (form, initial) =>
  Object.keys(emptyServiceForm).some((key) => form[key] !== initial[key]);
