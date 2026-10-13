export function getDashboardPath(role) {
  if (role === "customer") return "/dashboard";
  if (role === "staff" || role === "admin") return "/admin";
  return null;
}
