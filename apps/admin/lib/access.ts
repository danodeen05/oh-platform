/**
 * Single source of truth for who can open which admin page. Middleware,
 * the nav and the page guards all read this. The API enforces the same
 * split on its side (packages/api/src/auth/console-guard.js).
 */
export type AdminRole = "owner" | "manager" | "station";
export const ROLES: readonly AdminRole[] = ["owner", "manager", "station"];

const O: AdminRole[] = ["owner"];
const S: AdminRole[] = ["owner", "manager"];
const F: AdminRole[] = ["owner", "manager", "station"];

export type AccessRule = { path: string; roles: AdminRole[]; exact?: boolean };

export const ACCESS_RULES: AccessRule[] = [
  { path: "/", roles: S, exact: true },
  { path: "/orders", roles: S },
  { path: "/shop-orders", roles: S },
  { path: "/support", roles: S },
  { path: "/menu", roles: S },
  { path: "/promos", roles: S },
  { path: "/gift-cards", roles: S },
  { path: "/gift-cards/config", roles: O },
  { path: "/products", roles: S },
  { path: "/catering", roles: S },
  { path: "/kitchen", roles: F },
  { path: "/cleaning", roles: F },
  { path: "/cleaning/config", roles: S },
  { path: "/analytics", roles: S },
  { path: "/analytics/revenue", roles: O },
  { path: "/analytics/customers", roles: O },
  { path: "/analytics/funnel", roles: O },
  { path: "/plan-access", roles: O },
  { path: "/locations", roles: O },
  { path: "/tenants", roles: O },
  { path: "/kiosks", roles: O },
  { path: "/team", roles: O },
  { path: "/ui-kit", roles: S },
];

export const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/unauthorized"];

const matches = (rule: AccessRule, p: string) => (rule.exact ? p === rule.path : p === rule.path || p.startsWith(rule.path + "/"));

export function parseRole(value: unknown): AdminRole | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as AdminRole) : null;
}

export function ruleFor(pathname: string): AccessRule | undefined {
  return ACCESS_RULES.filter((r) => matches(r, pathname)).sort((a, b) => b.path.length - a.path.length)[0];
}

export function canAccess(role: AdminRole | null, pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (!role) return false;
  const rule = ruleFor(pathname);
  return rule ? rule.roles.includes(role) : role === "owner";
}

export function homeFor(role: AdminRole): string {
  return role === "station" ? "/kitchen" : "/";
}

export type Decision = { kind: "next" } | { kind: "redirect"; to: string };

export function decide(role: AdminRole | null, pathname: string): Decision {
  if (canAccess(role, pathname)) return { kind: "next" };
  return { kind: "redirect", to: role ? homeFor(role) : "/unauthorized" };
}
