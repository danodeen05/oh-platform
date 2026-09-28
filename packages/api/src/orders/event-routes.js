/**
 * CNY private-event ordering: phone enumeration guard (Task D10a, parked from A8b).
 *
 * GET /orders/event/check?phone= and POST /orders/event (one order per phone)
 * used to hand anyone who typed a phone number that guest's kitchen number
 * and order QR code. Now:
 *  - both routes share a per-IP limit: 10 calls per 10 minutes, 429 past it;
 *  - an unproven caller learns only { exists: boolean };
 *  - the order number, QR code and items come back only to the guest who
 *    placed the order, proven by that order's guest session token
 *    (x-guest-session, returned when the order was created and kept by the
 *    event page on that device).
 * The in-memory fixed window follows chappy/limits.js; per process, which is
 * enough for one API instance.
 */
import { rateLimitKey } from "../http-config.js";
import { GUEST_SESSION_HEADER } from "./group-routes.js";

export const EVENT_CHECK_LIMIT = Object.freeze({ max: 10, windowMs: 10 * 60 * 1000 });

/** Fixed-window counter per key: hit(key) records one use and says whether it was allowed. */
export function createIpLimiter({ max = EVENT_CHECK_LIMIT.max, windowMs = EVENT_CHECK_LIMIT.windowMs, now = () => Date.now() } = {}) {
  const store = new Map();
  return {
    hit(key) {
      const t = now();
      if (store.size > 20_000) for (const [k, e] of store) if (e.resetAt <= t) store.delete(k);
      let entry = store.get(key);
      if (!entry || entry.resetAt <= t) {
        entry = { count: 0, resetAt: t + windowMs };
        store.set(key, entry);
      }
      if (entry.count >= max) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) };
      entry.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Fastify preHandler: 429 once this client IP is past the event limit. */
export function eventRateLimit(limiter, keyFor = rateLimitKey) {
  return async function eventRateLimitHook(req, reply) {
    const r = limiter.hit(keyFor(req));
    if (!r.allowed) {
      reply.header("Retry-After", String(r.retryAfterSeconds));
      return reply.code(429).send({ error: "RATE_LIMITED", message: "Too many tries. Please wait a few minutes." });
    }
  };
}

/** True when the request carries the unexpired guest session that placed `order`. */
export async function provesEventGuest(req, order, findGuestBySessionToken, now = () => new Date()) {
  const token = req.headers?.[GUEST_SESSION_HEADER];
  if (!order?.guestId || typeof token !== "string" || !token) return false;
  const guest = await findGuestBySessionToken(token);
  return Boolean(guest && guest.id === order.guestId && (!guest.expiresAt || new Date(guest.expiresAt) > now()));
}

/** The duplicate-order refusal for POST /orders/event: no order number or QR code (the event page matches on this text). */
export function eventDuplicateBody() {
  return { error: "One order per guest allowed" };
}

/**
 * Registers GET /orders/event/check. `findEventOrderByPhone(digits)` returns
 * the guest's non-cancelled event order (with items and menuItem) or null.
 */
export function registerEventCheckRoute(app, { limiter, findEventOrderByPhone, findGuestBySessionToken, now = () => new Date() }) {
  app.get("/orders/event/check", { preHandler: eventRateLimit(limiter) }, async (req, reply) => {
    const phone = typeof req.query?.phone === "string" ? req.query.phone : "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return reply.code(400).send({ error: "Phone number required" });

    const order = await findEventOrderByPhone(digits);
    if (!order) return { exists: false };
    if (!(await provesEventGuest(req, order, findGuestBySessionToken, now))) return { exists: true };
    return {
      exists: true,
      kitchenOrderNumber: order.kitchenOrderNumber,
      orderQrCode: order.orderQrCode,
      items: (order.items || []).map((item) => ({ menuItem: { name: item.menuItem?.name }, selectedValue: item.selectedValue })),
    };
  });
}
