/**
 * Task A10b: routes that used to act on a client-supplied user id.
 * Small decision functions used by the handlers in index.js, kept here so they
 * can be unit tested (index.js listens on import).
 */

import { orderOwnerId } from "./customer.js";

/**
 * GET /users/referral/:code response. Public-safe only: the referrer's first
 * name, the code and validity. Never the email, database id or phone.
 */
export function publicReferral(user) {
  if (!user) return null;
  const first = typeof user.name === "string" ? user.name.trim().split(/\s+/)[0] : "";
  return { valid: true, code: user.referralCode, firstName: first || null };
}

/**
 * Whose credits POST /shop/orders/:id/apply-credits may spend: the verified
 * caller's, and only on a shop order that caller owns. A body userId is never
 * consulted. Returns { userId } or { status, error }.
 */
export function shopCreditSpender(who, order) {
  const me = orderOwnerId(who);
  if (!me) return { status: 401, error: "Sign in required" };
  if (!order) return { status: 404, error: "Order not found" };
  if (order.userId !== me) return { status: 403, error: "Forbidden" };
  return { userId: me };
}

/**
 * Who a POST /group-orders/:code/orders order belongs to. The member id is the
 * verified caller (same rule as POST /orders after A10); guests and anonymous
 * callers get userId null. guestId is a Guest (guest checkout) row id and is
 * kept as sent. Returns { userId, guestId } or { status, error }.
 */
export function groupOrderMember(who, body = {}) {
  const userId = orderOwnerId(who);
  const guestId = typeof body.guestId === "string" && body.guestId ? body.guestId : null;
  if (userId || guestId) return { userId, guestId };
  if (who?.kind === "user") return { status: 403, error: "No account for this sign-in yet" };
  if (body.userId) return { status: 401, error: "Sign in required" };
  return { status: 400, error: "Either a signed-in member or guestId required" };
}

/**
 * Operator-only routes that sit outside /admin/*. Wallet diagnostics are
 * admin only rather than 404 in production because APNs problems are only
 * debuggable against production (sandbox vs production push hosts); the
 * kiosk device routes mint and rotate the credential kiosk auth relies on.
 */
export const ADMIN_ONLY_ROUTES = Object.freeze([
  "/wallet/debug",
  "/wallet/test-push/:userId",
  "/wallet/refresh-all",
  "/kiosk-devices",
  "/kiosk-devices/:id",
  "/kiosk-devices/:id/rotate-key",
]);

/** onRoute hook: prepend requireAdminAuth to every ADMIN_ONLY_ROUTES route. Call before the routes are declared. */
export function registerAdminOnlyRoutes(app, requireAdminAuth, routes = ADMIN_ONLY_ROUTES) {
  const set = new Set(routes);
  app.addHook("onRoute", (route) => {
    if (!set.has(route.url)) return;
    const guard = async (req, reply) => {
      await requireAdminAuth(req, reply);
      if (reply.sent) return reply;
    };
    const existing = route.preHandler ? (Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler]) : [];
    route.preHandler = [guard, ...existing];
  });
}
