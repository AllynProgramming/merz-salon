export function getDashboardPath(role) {
  if (role === "customer") return "/dashboard";
  if (role === "staff" || role === "manager") return "/staff";
  if (role === "admin") return "/admin";
  return null;
}
