import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerOrderRoutes } from "../routes.js";
import { registerStatusDemoGuard } from "../../demo/status-demo.js";
import { seed, fakeStripe, fakeEffects, NOW, CLASSIC_BOWL } from "./fixtures.js";
import { createAdminAuth } from "../../auth/admin.js";

const DINE_IN_MESSAGE = "Online ordering is currently unavailable. Please visit us in person.";

/** Customer identity double: "Bearer test:<userId>" is a verified member. */
const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer test:")) return { kind: "user", userId: h.slice(12), email: "x@x.com" };
    return { kind: "anonymous" };
  },
  async requireUser(req, reply) {
    const who = await this.resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    return who;
  },
};

/** Kiosk device double: "Bearer kiosk_L1" is the device at location L1. */
const fakeKioskAuth = {
  async deviceFor(req) {
    const h = req.headers.authorization || "";
    return h === "Bearer kiosk_L1" ? { id: "dev1", locationId: "L1", isActive: true } : null;
  },
};

const auth = (userId) => ({ authorization: `Bearer test:${userId}` });
const KIOSK = { authorization: "Bearer kiosk_L1" };

async function buildApp({ stripe = fakeStripe(), dineIn = true, orders, checkAdminAuth } = {}) {
  const prisma = seed({
    orders: orders ?? [
      { id: "o1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1999, subtotalCents: 1817, taxCents: 182, amountDueCents: 1999, creditsAppliedCents: 0, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
    ],
    orderItems: [{ id: "oi1", orderId: "o1", menuItemId: "wagyu", quantity: 1, priceCents: 2399 }],
  });
  const { calls, effects } = fakeEffects();
  const app = Fastify({ logger: false });
  // The deny-by-default demo guard runs before every route, as in index.js.
  registerStatusDemoGuard(app, { source: { menuItems: async () => [] } });
  await registerOrderRoutes(app, {
    prisma,
    stripe,
    customerAuth: fakeCustomerAuth,
    kioskAuth: fakeKioskAuth,
    checkAdminAuth,
    isDineInOrdersEnabled: () => dineIn,
    effects,
    now: () => NOW,
  });
  await app.ready();
  return { app, prisma, calls, stripe };
}

/**
 * Task A8b, fix round 2: `POST /orders/:id/confirm-payment` and
 * `PATCH /orders/:id` are public and used to return the full order,
 * including `user`/`guest` contact fields, to any caller. A real
 * `createAdminAuth`, configured production-like (NODE_ENV=production, a
 * set ADMIN_API_KEY), so "staff" is opt-in via `x-admin-api-key` rather
 * than this worktree's dev-open bypass (no ADMIN_API_KEY -> everyone is
 * staff) - that bypass is untouched and stays exactly as it was.
 */
const PROD_ADMIN_ENV = { NODE_ENV: "production", ADMIN_API_KEY: "admin-key-123" };
const prodCheckAdminAuth = createAdminAuth({ env: PROD_ADMIN_ENV }).checkAdminAuth;
const ADMIN = { "x-admin-api-key": "admin-key-123" };

describe("payment integrity", () => {
  test("client cannot mark an order paid without a verified PaymentIntent", async () => {
    const { app, prisma } = await buildApp({ stripe: fakeStripe({ pi_1: { status: "requires_payment_method", amount: 1999, metadata: { orderId: "o1" } } }) });
    const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: auth("u1"), payload: { paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 402);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PENDING");
  });

  test("PATCH /orders/:id ignores paymentStatus", async () => {
    const { app, prisma } = await buildApp();
    for (const payload of [{ paymentStatus: "PAID" }, { totalCents: 1 }, { taxCents: 0 }, { promoCodeId: "p1", promoDiscountCents: 1999 }, { stripePaymentId: "pi_fake" }]) {
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", headers: auth("u1"), payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
      assert.match(res.json().error, /unknown field/);
    }
    const row = await prisma.order.findUnique({ where: { id: "o1" } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal(row.totalCents, 1999);
  });

  test("PATCH /orders/:id cannot send an unpaid order to the kitchen", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/orders/o1", payload: { status: "QUEUED" } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "ORDER_NOT_PAID");
  });

  test("PATCH /orders/:id still takes the fields its callers use", async () => {
    const { app, prisma } = await buildApp();
    const arrival = new Date(NOW.getTime() + 15 * 60 * 1000).toISOString();
    const res = await app.inject({ method: "PATCH", url: "/orders/o1", payload: { estimatedArrival: arrival } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).estimatedArrival.toISOString(), arrival);
  });

  test("amount mismatch is rejected", async () => {
    const { app, prisma } = await buildApp({ stripe: fakeStripe({ pi_1: { status: "succeeded", amount: 100, metadata: { orderId: "o1" } } }) });
    const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: auth("u1"), payload: { paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 402);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PENDING");
  });

  test("a verified PaymentIntent pays the order; a repeat is idempotent", async () => {
    const { app, prisma, calls } = await buildApp({ stripe: fakeStripe({ pi_1: { status: "succeeded", amount: 1999, metadata: { orderId: "o1" } } }) });
    const first = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", payload: { paymentIntentId: "pi_1" } });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().paymentStatus, "PAID");
    const again = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", payload: { paymentIntentId: "pi_1" } });
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().alreadyPaid, true);
    assert.equal(calls.sendOrderConfirmation, 1);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).status, "QUEUED");
  });

  test("POST /orders/:id/payment-intent charges the order's amount due", async () => {
    const { app, stripe } = await buildApp();
    const res = await app.inject({ method: "POST", url: "/orders/o1/payment-intent", headers: auth("u1"), payload: { amountCents: 50 } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().clientSecret, "pi_test_1_secret_abc");
    assert.equal(stripe.created[0].amount, 1999);
    assert.deepEqual(stripe.created[0].metadata, { orderId: "o1" });
  });
});

describe("POST /orders", () => {
  test("dine-in flag off returns 403 with the existing message", async () => {
    const { app } = await buildApp({ dineIn: false });
    const res = await app.inject({ method: "POST", url: "/orders", headers: auth("u1"), payload: { locationId: "L1", items: CLASSIC_BOWL } });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, DINE_IN_MESSAGE);
  });

  test("the server prices the order; a body userId or totalCents is ignored", async () => {
    const { app, prisma } = await buildApp({ orders: [] });
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: auth("u1"),
      payload: { locationId: "L1", tenantId: "t1", items: CLASSIC_BOWL, userId: "u2", totalCents: 1, estimatedArrival: new Date(NOW.getTime() + 30 * 60 * 1000).toISOString(), seat: { best: true } },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.equal(body.userId, "u1");
    assert.equal(body.amountDueCents, 1924);
    assert.equal(body.seatId, "s-a01");
    const row = await prisma.order.findUnique({ where: { id: body.id } });
    assert.equal(row.totalCents, 1924);
  });

  test("an unreleased item is 400 ITEM_NOT_RELEASED", async () => {
    const { app } = await buildApp({ orders: [] });
    const res = await app.inject({ method: "POST", url: "/orders", headers: auth("u1"), payload: { locationId: "L1", items: [{ menuItemId: "preview", quantity: 1 }] } });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, "ITEM_NOT_RELEASED");
    assert.equal(res.json().menuItemId, "preview");
  });

  test("POST /orders/quote writes nothing", async () => {
    const { app, prisma } = await buildApp({ orders: [] });
    const res = await app.inject({ method: "POST", url: "/orders/quote", payload: { locationId: "L1", items: CLASSIC_BOWL } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().totalCents, 1924);
    assert.equal((await prisma.order.findMany()).length, 0);
  });

  test("a kiosk order is pinned to the device's location", async () => {
    const { app } = await buildApp({ orders: [] });
    const other = await app.inject({ method: "POST", url: "/orders", headers: KIOSK, payload: { locationId: "L2", items: CLASSIC_BOWL, guestName: "Sam" } });
    assert.equal(other.statusCode, 403);
    const ok = await app.inject({ method: "POST", url: "/orders", headers: KIOSK, payload: { locationId: "L1", items: CLASSIC_BOWL, guestName: "Sam" } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().orderSource, "KIOSK");
  });
});

describe("apply-credits is a quote update", () => {
  test("sets creditsAppliedCents for the owner and spends nothing", async () => {
    const { app, prisma } = await buildApp();
    await prisma.creditLot.create({ data: { userId: "u1", source: "WELCOME", amountCents: 800, remainingCents: 800, expiresAt: new Date(NOW.getTime() + 86400000) } });
    const res = await app.inject({ method: "POST", url: "/orders/o1/apply-credits", headers: auth("u1"), payload: { creditsCents: 800 } });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().appliedCredits, 500);
    const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
    assert.equal(lots[0].remainingCents, 800);
    const other = await app.inject({ method: "POST", url: "/orders/o1/apply-credits", headers: auth("u2"), payload: { creditsCents: 100 } });
    assert.equal(other.statusCode, 403);
    const anon = await app.inject({ method: "POST", url: "/orders/o1/apply-credits", payload: { creditsCents: 100 } });
    assert.equal(anon.statusCode, 401);
  });
});

describe("kiosk confirm path", () => {
  test("needs device auth and a PaymentIntent covering exactly the listed orders", async () => {
    const orders = [
      { id: "k1", locationId: "L1", tenantId: "t1", totalCents: 1000, amountDueCents: 1000, creditsAppliedCents: 0, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
      { id: "k2", locationId: "L1", tenantId: "t1", totalCents: 500, amountDueCents: 500, creditsAppliedCents: 0, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
    ];
    const stripe = fakeStripe({ pi_t: { status: "succeeded", amount: 1500, metadata: { orderIds: "k1,k2" } } });
    const { app, prisma } = await buildApp({ stripe, orders });
    const anon = await app.inject({ method: "POST", url: "/kiosk/orders/confirm-payment", payload: { paymentIntentId: "pi_t", orderIds: ["k1", "k2"] } });
    assert.equal(anon.statusCode, 401);
    const partial = await app.inject({ method: "POST", url: "/kiosk/orders/confirm-payment", headers: KIOSK, payload: { paymentIntentId: "pi_t", orderIds: ["k1"] } });
    assert.equal(partial.statusCode, 402);
    const ok = await app.inject({ method: "POST", url: "/kiosk/orders/confirm-payment", headers: KIOSK, payload: { paymentIntentId: "pi_t", orderIds: ["k1", "k2"] } });
    assert.equal(ok.statusCode, 200, ok.body);
    for (const id of ["k1", "k2"]) assert.equal((await prisma.order.findUnique({ where: { id } })).paymentStatus, "PAID");
  });

  test("the kiosk PaymentIntent amount is the orders' sum, with metadata.orderIds", async () => {
    const orders = [
      { id: "k1", locationId: "L1", tenantId: "t1", totalCents: 1000, amountDueCents: 1000, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
      { id: "k2", locationId: "L1", tenantId: "t1", totalCents: 500, amountDueCents: 500, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
    ];
    const { app, stripe } = await buildApp({ orders });
    const res = await app.inject({ method: "POST", url: "/kiosk/orders/payment-intent", headers: KIOSK, payload: { orderIds: ["k1", "k2"], amountCents: 1 } });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(stripe.created[0].amount, 1500);
    assert.equal(stripe.created[0].metadata.orderIds, "k1,k2");
    assert.deepEqual(stripe.created[0].payment_method_types, ["card_present"]);
  });
});

describe("plan status demo", () => {
  test("POST /orders/demo-plan/confirm-payment is refused by the demo deny guard", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "POST", url: "/orders/demo-plan/confirm-payment", payload: { paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().demo, true);
  });
});

describe("refund outcome reaches the caller", () => {
  test("confirm-payment: an unexpected settle failure after a verified charge is a 500 that says refunded", async () => {
    const { app, prisma, stripe } = await buildApp({ stripe: fakeStripe({ pi_1: { status: "succeeded", amount: 1999, metadata: { orderId: "o1" } } }) });
    prisma.$transaction = async () => {
      throw new Error("db down");
    };
    const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", payload: { paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json(), { error: "PAYMENT_NOT_APPLIED", message: "Payment could not be applied.", refunded: true });
    assert.equal(stripe.refundCalls.length, 1);
  });

  test("kiosk confirm passes refunded through on a 409", async () => {
    const orders = [{ id: "k1", locationId: "L1", tenantId: "t1", totalCents: 1000, amountDueCents: 1000, creditsAppliedCents: 500, userId: null, paymentStatus: "PENDING", status: "PENDING_PAYMENT" }];
    const stripe = fakeStripe({ pi_t: { status: "succeeded", amount: 1000, metadata: { orderIds: "k1" } } });
    const { app } = await buildApp({ stripe, orders });
    const res = await app.inject({ method: "POST", url: "/kiosk/orders/confirm-payment", headers: KIOSK, payload: { paymentIntentId: "pi_t", orderIds: ["k1"] } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "CREDIT_SHORT");
    assert.equal(res.json().refunded, true);
  });
});

describe("A8b fix round 2: POST /orders/:id/confirm-payment and PATCH /orders/:id gate the response", () => {
  // prisma-memory ignores `include`/`select` (ORDER_INCLUDE never resolves the
  // `user` relation against it - see prisma-memory.js's own doc comment), so a
  // seeded order embeds `user` directly: `findUnique` returns whatever was
  // stored, same as a real Prisma `include` would attach it. That's enough to
  // exercise canSeeFullOrder/safeOrderView, which only look at whatever
  // `order.user` already is - they don't care how it got there.
  const EMBEDDED_USER = { id: "u1", name: "Dana Kim", email: "u1@x.com", phone: "555-0100", smsOptIn: true };

  function paidOrder(overrides = {}) {
    return { id: "o1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1999, subtotalCents: 1817, taxCents: 182, amountDueCents: 1999, creditsAppliedCents: 0, paymentStatus: "PENDING", status: "PENDING_PAYMENT", user: EMBEDDED_USER, ...overrides };
  }

  function paidStripe() {
    return fakeStripe({ pi_1: { status: "succeeded", amount: 1999, metadata: { orderId: "o1" } } });
  }

  describe("POST /orders/:id/confirm-payment", () => {
    test("anonymous gets no contact fields", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()] });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal("user" in body, false);
      assert.equal(JSON.stringify(body).includes("u1@x.com"), false);
      // Still fully functional for a caller that only needs status/totals.
      assert.equal(body.paymentStatus, "PAID");
      assert.equal(body.totalCents, 1999);
    });

    test("the owner gets the full record, including user contact fields", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()] });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: auth("u1"), payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("staff (x-admin-api-key, production-like) gets the full record", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()], checkAdminAuth: prodCheckAdminAuth });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: ADMIN, payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("a kiosk device at the order's own location gets the full record", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()] });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: KIOSK, payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("a kiosk device at a DIFFERENT location gets no contact fields", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder({ locationId: "L2" })] });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: KIOSK, payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      assert.equal("user" in res.json(), false);
    });

    test("a signed-in customer who is not the owner gets no contact fields", async () => {
      const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()] });
      const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: auth("u2"), payload: { paymentIntentId: "pi_1" } });
      assert.equal(res.statusCode, 200);
      assert.equal("user" in res.json(), false);
    });
  });

  describe("PATCH /orders/:id", () => {
    function queuedOrder(overrides = {}) {
      return paidOrder({ paymentStatus: "PAID", status: "QUEUED", ...overrides });
    }

    test("anonymous gets no contact fields", async () => {
      const { app } = await buildApp({ orders: [queuedOrder()] });
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", payload: { status: "PREPPING" } });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal("user" in body, false);
      assert.equal(JSON.stringify(body).includes("u1@x.com"), false);
      assert.equal(body.status, "PREPPING");
    });

    test("the owner gets the full record", async () => {
      const { app } = await buildApp({ orders: [queuedOrder()] });
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", headers: auth("u1"), payload: { status: "PREPPING" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("staff (x-admin-api-key, production-like) gets the full record", async () => {
      const { app } = await buildApp({ orders: [queuedOrder()], checkAdminAuth: prodCheckAdminAuth });
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", headers: ADMIN, payload: { status: "PREPPING" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("a kiosk device at the order's own location gets the full record", async () => {
      const { app } = await buildApp({ orders: [queuedOrder()] });
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", headers: KIOSK, payload: { status: "PREPPING" } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().user.email, "u1@x.com");
    });

    test("a kiosk device at a DIFFERENT location gets no contact fields", async () => {
      // The fixture's kiosk device double is pinned to L1; an order at L2 is a location mismatch.
      const { app } = await buildApp({ orders: [queuedOrder({ locationId: "L2" })] });
      const res = await app.inject({ method: "PATCH", url: "/orders/o1", headers: KIOSK, payload: { status: "PREPPING" } });
      assert.equal(res.statusCode, 200);
      assert.equal("user" in res.json(), false);
    });
  });

  // Confirms the dev-open admin bypass (no ADMIN_API_KEY, non-production) is
  // untouched by this fix: a real `createAdminAuth()` in that mode treats
  // everyone as staff, same as every other admin-gated route in local dev.
  // This test uses a real createAdminAuth with no ADMIN_API_KEY and no
  // NODE_ENV to prove that specific behavior is unchanged, not to rely on it
  // elsewhere (every other test above sets up production-like staff auth
  // explicitly via `prodCheckAdminAuth`).
  test("dev bypass: createAdminAuth() with no ADMIN_API_KEY and no NODE_ENV=production treats an anonymous caller as staff, unchanged", async () => {
    const devCheckAdminAuth = createAdminAuth({ env: {} }).checkAdminAuth;
    const { app } = await buildApp({ stripe: paidStripe(), orders: [paidOrder()], checkAdminAuth: devCheckAdminAuth });
    const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", payload: { paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user.email, "u1@x.com");
  });
});
