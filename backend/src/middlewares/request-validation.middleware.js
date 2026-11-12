export const validate = (schema, source, options = {}) => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = typeof options.message === "function" ? options.message(result.error) : (options.message || issue?.message || "Invalid request data.");
    const payload = { message };
    if (options.includeErrors) payload.errors = result.error.issues.map((item) => ({ field: item.path[0], message: item.message }));
    return res.status(options.status || 400).json(payload);
  }
  if (source === "query" || source === "params") {
    Object.keys(req[source]).forEach((key) => delete req[source][key]);
    Object.assign(req[source], result.data);
  } else {
    req[source] = result.data;
  }
  next();
};
export const validateBody = (schema, options) => validate(schema, "body", options);
export const validateQuery = (schema, options) => validate(schema, "query", options);
export const validateParams = (schema, options) => validate(schema, "params", options);
