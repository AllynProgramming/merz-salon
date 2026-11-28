// A tiny toast store shared by every admin page. Pages call toast.success()
// or toast.error(); <Toaster /> (rendered by AdminNavigation) shows them.

let toasts = [];
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const dismissToast = (id) => {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
};

const show = (tone, message, { duration = 4500 } = {}) => {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, tone, message }];
  emit();
  if (duration) window.setTimeout(() => dismissToast(id), duration);
  return id;
};

export const toast = {
  success: (message, options) => show("success", message, options),
  error: (message, options) => show("error", message, { duration: 7000, ...options }),
};

export const subscribeToToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getToasts = () => toasts;
