/**
 * Task D10a (parked from A8b): the CNY event check can't be used to enumerate
 * phones. Per-IP limit of 10 per 10 minutes, and only { exists } unless the
 * caller holds the order's guest session.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerEventCheckRoute, createIpLimiter, eventRateLimit, eventDuplicateBody, EVENT_CHECK_LIMIT } from "../event-routes.js";

const NOW = new Date("2026-10-01T12:00:00-06:00");
const ORDER = {
  id: "o_cny",
  guestId: "g_cny",
  kitchenOrderNumber: "0007",
  orderQrCode: "CNY-QR-SECRET",
  items: [{ menuItem: { name: "Beef Noodle Soup" }, selectedValue: null }],
};
const GUESTS = { "tok-cny": { id: "g_cny", expiresAt: new Date(NOW.getTime() + 60_000) }, "tok-other": { id: "g_other", expiresAt: new Date(NOW.getTime() + 60_000) } };

async function buildApp({ clock = () => NOW.getTime() } = {}) {
  const app = Fastify({ logger: false });
  const limiter = createIpLimiter({ now: clock });
  registerEventCheckRoute(app, {
    limiter,
    findEventOrderByPhone: async (digits) => (digits.endsWith("8015550100") ? ORDER : null),
    findGuestBySessionToken: async (token) => GUESTS[token] || null,
    now: () => NOW,
  });
  app.post("/orders/event", { preHandler: eventRateLimit(limiter) }, async () => ({ ok: true }));
  await app.ready();
  return app;
}

const check = (app, phone, headers = {}, ip = "203.0.113.5") => app.inject({ method: "GET", url: `/orders/event/check?phone=${encodeURIComponent(phone)}`, headers, remoteAddress: ip });

describe("GET /orders/event/check", () => {
  test("an unproven caller gets only { exists }, never the QR code or order number", async () => {
    const app = await buildApp();
    const hit = await check(app, "(801) 555-0100");
    assert.equal(hit.statusCode, 200);
    assert.deepEqual(hit.json(), { exists: true });
    assert.ok(!hit.body.includes("CNY-QR-SECRET"));
    const wrongGuest = await check(app, "(801) 555-0100", { "x-guest-session": "tok-other" });
    assert.deepEqual(wrongGuest.json(), { exists: true });
    const miss = await check(app, "(801) 555-0199");
    assert.deepEqual(miss.json(), { exists: false });
  });

  test("the guest who placed the order (its guest session) still sees number, QR code and items", async () => {
    const app = await buildApp();
    const res = await check(app, "8015550100", { "x-guest-session": "tok-cny" });
    assert.deepEqual(res.json(), { exists: true, kitchenOrderNumber: "0007", orderQrCode: "CNY-QR-SECRET", items: [{ menuItem: { name: "Beef Noodle Soup" }, selectedValue: null }] });
  });

  test("the 11th call from one IP within 10 minutes is 429; another IP is unaffected; the window resets", async () => {
    let t = NOW.getTime();
    const app = await buildApp({ clock: () => t });
    for (let i = 1; i <= EVENT_CHECK_LIMIT.max; i++) {
      const res = await check(app, `80155501${String(i).padStart(2, "0")}`);
      assert.equal(res.statusCode, 200, `call ${i}`);
    }
    const eleventh = await check(app, "8015550111");
    assert.equal(eleventh.statusCode, 429);
    assert.ok(Number(eleventh.headers["retry-after"]) > 0);
    assert.equal((await check(app, "8015550100", {}, "198.51.100.9")).statusCode, 200);
    t += EVENT_CHECK_LIMIT.windowMs + 1;
    assert.equal((await check(app, "8015550100")).statusCode, 200);
  });

  test("POST /orders/event shares the same per-IP budget", async () => {
    const app = await buildApp();
    for (let i = 0; i < 10; i++) await check(app, "8015550100");
    const post = await app.inject({ method: "POST", url: "/orders/event", payload: {}, remoteAddress: "203.0.113.5" });
    assert.equal(post.statusCode, 429);
  });

  test("the duplicate-order refusal carries no order number or QR code", () => {
    assert.deepEqual(eventDuplicateBody(), { error: "One order per guest allowed" });
  });
});
