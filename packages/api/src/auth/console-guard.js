/**
 * Console-only API routes that live outside /admin.
 *
 * Before 2026-09-27 only /admin/* was guarded, so these were open to anyone.
 * registerConsoleGuard adds requireAdminAuth (and, from Phase 1, a role check)
 * as the first preHandler of each listed route. It must be registered before
 * the routes are declared. Customer, kiosk, webhook and cron routes are listed
 * in public-routes.js; the classification test fails on any route in neither.
 */
export const OWNER = Object.freeze(["owner"]);
export const STAFF = Object.freeze(["owner", "manager"]);
export const FLOOR = Object.freeze(["owner", "manager", "station"]);

const r = (method, url, roles) => Object.freeze({ method, url, roles });

export const CONSOLE_ROUTES = Object.freeze([
  // Setup: tenants, locations, kiosk devices
  r("POST", "/tenants", OWNER),
  r("PATCH", "/tenants/:id", OWNER),
  r("DELETE", "/tenants/:id", OWNER),
  r("POST", "/locations", OWNER),
  r("PATCH", "/locations/:id", OWNER),
  r("DELETE", "/locations/:id", OWNER),
  r("POST", "/locations/geocode", OWNER),
  r("POST", "/locations/validate-address", OWNER),
  r("POST", "/kiosk-devices", OWNER),
  r("GET", "/kiosk-devices", OWNER),
  r("GET", "/kiosk-devices/:id", OWNER),
  r("PUT", "/kiosk-devices/:id", OWNER),
  r("POST", "/kiosk-devices/:id/rotate-key", OWNER),
  r("DELETE", "/kiosk-devices/:id", OWNER),
  // Menu and promos
  r("POST", "/menu", STAFF),
  r("PATCH", "/menu/:id", STAFF),
  r("DELETE", "/menu/:id", STAFF),
  r("GET", "/promo-codes", STAFF),
  r("GET", "/promo-codes/:id", STAFF),
  r("POST", "/promo-codes", STAFF),
  r("PATCH", "/promo-codes/:id", OWNER), // no caller in apps/; distinct from the guarded /admin/promo-codes/:id the admin UI actually uses
  r("DELETE", "/promo-codes/:id", STAFF),
  r("POST", "/promo-codes/:id/apply", OWNER),
  // Seats and pods
  r("GET", "/seats", OWNER),
  r("POST", "/seats", OWNER),
  r("PATCH", "/seats/:id", OWNER),
  r("DELETE", "/seats/:id", OWNER),
  r("POST", "/seats/link-dual", STAFF),
  r("POST", "/seats/unlink-dual", STAFF),
  r("PATCH", "/seats/:id/clean", FLOOR),
  r("POST", "/seats/:id/force-clean", FLOOR),
  r("POST", "/orders/:id/assign-pod", OWNER),
  r("POST", "/orders/:id/confirm-pod", OWNER),
  r("POST", "/orders/:id/release-pod", OWNER),
  // Kitchen and cleaning displays
  r("GET", "/pod-calls", FLOOR),
  r("PATCH", "/pod-calls/:id/acknowledge", FLOOR),
  r("PATCH", "/pod-calls/:id/resolve", FLOOR),
  r("DELETE", "/pod-calls/:id", FLOOR),
  r("GET", "/kitchen/orders", FLOOR),
  r("GET", "/kitchen/pickup-orders", FLOOR),
  r("GET", "/kitchen/cny-stats", FLOOR),
  r("GET", "/kitchen/stats", FLOOR),
  r("GET", "/kitchen/average-processing-time", FLOOR),
  r("GET", "/cleaning/average-time", FLOOR),
  // Orders with customer data
  r("GET", "/orders", OWNER),
  r("GET", "/orders/by-number/:orderNumber", STAFF),
  // Analytics: money views are owner-only (spec A6)
  r("GET", "/analytics/overview", OWNER),
  r("GET", "/analytics/realtime", OWNER),
  r("GET", "/analytics/revenue", OWNER),
  r("GET", "/analytics/order-sources", OWNER),
  r("GET", "/analytics/customers", OWNER),
  r("GET", "/analytics/ga4/funnel", OWNER),
  r("GET", "/analytics/operations", STAFF),
  r("GET", "/analytics/menu", STAFF),
  r("GET", "/analytics/upselling", STAFF),
  r("GET", "/analytics/ga4/traffic", STAFF),
  r("GET", "/analytics/ga4/pages", STAFF),
  r("GET", "/analytics/ga4/sources", STAFF),
  r("GET", "/analytics/ga4/devices", STAFF),
  r("GET", "/analytics/ga4/geo", STAFF),
  r("GET", "/analytics/ga4/realtime", STAFF),
  r("GET", "/analytics/ga4/hourly", STAFF),
  r("GET", "/analytics/language", STAFF),
  r("GET", "/analytics/challenges", STAFF),
  r("GET", "/analytics/badges", STAFF),
  // Agents (autonomous/routes.js): no auth of its own; only the routes the web
  // proxy actually calls (see public-routes.js) stay public. These have no caller
  // anywhere in apps/, so they were silently open before this fix.
  r("GET", "/agents/ideas", OWNER),
  r("POST", "/agents/runs/:id/cancel", OWNER),
  r("GET", "/agents/approvals", OWNER),
  r("GET", "/agents/questions", OWNER),
  r("POST", "/agents/classify", OWNER),
  r("POST", "/agents/notifications/devices", OWNER),
  r("DELETE", "/agents/notifications/devices/:deviceId", OWNER),
  r("POST", "/agents/notifications/test", OWNER),
  r("GET", "/agents/models/routing", OWNER),
  r("GET", "/agents/models/usage", OWNER),
  r("POST", "/agents/models/estimate", OWNER),
  r("GET", "/agents/scheduler/status", OWNER),
  r("POST", "/agents/scheduler/trigger", OWNER),
  r("GET", "/agents/health", OWNER),
  // Unused but dangerous when open
  r("POST", "/challenges", OWNER),
  r("PATCH", "/challenges/:id", OWNER),
  r("DELETE", "/challenges/:id", OWNER),
  r("GET", "/gift-cards/:id", STAFF),
  r("PATCH", "/shop/products/:id/inventory", STAFF),
  r("GET", "/shop/products/inventory/low-stock", STAFF),
  r("GET", "/shop/orders/:id", STAFF),
  // Fulfillment fields only (D10a); no caller since the webhook stopped using it.
  r("PATCH", "/shop/orders/:id", STAFF),
  r("POST", "/shop/orders/:id/apply-credits", OWNER),
  r("GET", "/users/:id/shop-orders", OWNER),
  r("POST", "/payments/confirm", OWNER),
  r("POST", "/wallet/refresh-all", OWNER),
  r("GET", "/wallet/debug", OWNER),
  r("POST", "/wallet/test-push/:userId", OWNER),
  r("POST", "/meal-gifts/expire", OWNER),
  r("GET", "/notifications/status", OWNER),
]);

/** Called by the customer site, kiosks, mobile or the Stripe webhook without admin auth. */
export const MUST_STAY_OPEN = Object.freeze([
  { method: "PATCH", url: "/orders/:id" },
  { method: "PATCH", url: "/kitchen/orders/:id/status" },
  { method: "GET", url: "/orders/:id" },
  { method: "GET", url: "/orders/status" },
  { method: "POST", url: "/orders" },
  { method: "POST", url: "/orders/check-in" },
  { method: "GET", url: "/orders/lookup" },
  { method: "GET", url: "/orders/by-member" },
  { method: "POST", url: "/analytics/language" },
  { method: "POST", url: "/promo-codes/validate" },
  { method: "GET", url: "/menu" },
  { method: "GET", url: "/menu/steps" },
  { method: "GET", url: "/tenants" },
  { method: "GET", url: "/locations" },
  { method: "GET", url: "/locations/:id/seats" },
  { method: "GET", url: "/locations/:id/availability" },
  { method: "POST", url: "/kiosk/auth" },
  { method: "POST", url: "/kiosk/heartbeat" },
  { method: "POST", url: "/shop/orders/:id/confirm-payment" },
  { method: "POST", url: "/gift-cards/confirm-payment" },
  { method: "GET", url: "/catering/site-config/order-now" },
  { method: "GET", url: "/catering/kitchen-locations" },
]);

export function routeKey(method, url) {
  return `${String(method).toUpperCase()} ${url}`;
}

const OWNER_ADMIN_PREFIXES = ["/admin/plan", "/admin/gift-card-config", "/admin/team"];

/** Roles allowed on an /admin/* URL (Phase 1 applies it in the /admin onRequest hook). */
export function adminPathRoles(url) {
  const path = String(url).split("?")[0];
  return OWNER_ADMIN_PREFIXES.some((p) => path === p || path.startsWith(p + "/")) ? OWNER : STAFF;
}

/**
 * The path Fastify actually routed this request to. Use this, never raw req.url,
 * for auth decisions: /%61dmin/... routes to /admin/... but doesn't startWith("/admin").
 */
export function requestPath(req) {
  const matched = req.routeOptions?.url;
  if (typeof matched === "string" && matched.length > 0) return matched;
  const raw = String(req.url || "").split("?")[0];
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/** Admin auth on every /admin route, decided on the routed path (see requestPath). */
export function registerAdminPathGuard(app, { requireAdminAuth }) {
  app.addHook("onRequest", async (req, reply) => {
    if (requestPath(req).startsWith("/admin")) {
      await requireAdminAuth(req, reply);
      if (reply.sent) return reply;
    }
  });
}

export function registerConsoleGuard(app, { requireAdminAuth, requireRole, routes = CONSOLE_ROUTES }) {
  const index = new Map(routes.map((route) => [routeKey(route.method, route.url), route]));
  app.addHook("onRoute", (opts) => {
    const methods = Array.isArray(opts.method) ? opts.method : [opts.method];
    const entry = methods
      .map((m) => index.get(routeKey(m === "HEAD" ? "GET" : m, opts.url)))
      .find(Boolean);
    if (!entry) return;
    const existing = opts.preHandler ? [].concat(opts.preHandler) : [];
    const guards = [requireAdminAuth];
    if (requireRole) guards.push(requireRole(...entry.roles));
    opts.preHandler = [...guards, ...existing.filter((h) => !guards.includes(h))];
  });
}
