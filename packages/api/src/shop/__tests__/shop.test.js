/**
 * Task D10a: merch shop orders follow the food-order rule. The server decides
 * every amount, and PAID follows only a verified PaymentIntent (or a
 * server-verified zero balance). Real Fastify injects against the plugins
 * index.js registers.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { fakeStripe } from "../../orders/__tests__/fixtures.js";
import { registerShopOrderRoutes } from "../routes.js";
import { registerPurchaseIntentRoute } from "../../orders/purchase-intents.js";
import { shopTotals, shopAmountDue, applyShopCredits, paymentAuditNotes, markShopOrderPaidByStaff, confirmShopPayment } from "../service.js";

const NOW = new Date("2026-10-01T12:00:00-06:00");
const DAY = 24 * 60 * 60 * 1000;

const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    return h.startsWith("Bearer test:") ? { kind: "user", userId: h.slice(12), email: "x@x.com" } : { kind: "anonymous" };
  },
  async requireUser(req, reply) {
    const who = await this.resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    return who;
  },
  isServiceCall: (req) => req.headers["x-admin-api-key"] === "svc",
};

const as = (userId) => ({ authorization: `Bearer test:${userId}` });
const SERVICE = { "x-admin-api-key": "svc" };

function seedShop(extra = {}) {
  return makeMemoryPrisma({
    users: [
      { id: "u1", email: "u1@x.com", creditsCents: 3000 },
      { id: "u2", email: "u2@x.com", creditsCents: 0 },
    ],
    creditLots: [{ id: "lot1", userId: "u1", source: "CASHBACK", amountCents: 3000, remainingCents: 3000, expiresAt: new Date(NOW.getTime() + 30 * DAY) }],
    guests: [{ id: "g1", sessionToken: "guest-tok", expiresAt: new Date(NOW.getTime() + DAY) }],
    shopProducts: [
      { id: "p_bowl", slug: "bowl", name: "Bowl", priceCents: 2500, isAvailable: true, stockCount: 5 },
      { id: "p_sticks", slug: "chopsticks", name: "Chopsticks", priceCents: 1200, isAvailable: true, stockCount: null },
    ],
    ...extra,
  });
}

async function buildApp(prisma = seedShop(), stripe = fakeStripe(), { clock = () => NOW } = {}) {
  const app = Fastify({ logger: false });
  const paidCalls = [];
  const { shopOrderAccess } = await registerShopOrderRoutes(app, {
    prisma,
    stripe,
    customerAuth: fakeCustomerAuth,
    onShopOrderPaid: async (order) => paidCalls.push(order.id),
    now: clock,
  });
  registerPurchaseIntentRoute(app, { prisma, stripe, customerAuth: fakeCustomerAuth, shopOrderAccess });
  await app.ready();
  return { app, prisma, stripe, paidCalls };
}

const LINES = [{ productId: "bowl", quantity: 1, priceCents: 1 }, { productId: "p_sticks", quantity: 2, priceCents: 1 }];

async function createOrder(app, headers = as("u1"), extra = {}) {
  const res = await app.inject({ method: "POST", url: "/shop/orders", headers, payload: { items: LINES, fulfillmentType: "SHIPPING", subtotalCents: 1, totalCents: 1, ...extra } });
  return res;
}

async function payIntent(app, stripe, order, headers = as("u1")) {
  const res = await app.inject({ method: "POST", url: "/create-payment-intent", headers, payload: { kind: "shop_order", shopOrderId: order.id } });
  const id = res.json().id;
  stripe.intents[id].status = "succeeded";
  return id;
}

async function confirm(app, order, paymentIntentId, headers = as("u1")) {
  return app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers, payload: { paymentIntentId } });
}

describe("shop totals", () => {
  test("shipping under $75, 8% tax on the subtotal after savings", () => {
    assert.deepEqual(shopTotals({ subtotalCents: 4900, fulfillmentType: "SHIPPING" }), { shippingCents: 899, taxCents: 392, totalCents: 6191 });
    assert.deepEqual(shopTotals({ subtotalCents: 8000, fulfillmentType: "SHIPPING" }), { shippingCents: 0, taxCents: 640, totalCents: 8640 });
    assert.deepEqual(shopTotals({ subtotalCents: 4900, fulfillmentType: "IN_STORE_PICKUP", creditsApplied: 1000 }), { shippingCents: 0, taxCents: 312, totalCents: 4212 });
  });
});

describe("POST /shop/orders", () => {
  test("prices every line from the product rows, ignores client prices, and stays unpaid", async () => {
    const { app, prisma } = await buildApp();
    const res = await createOrder(app);
    assert.equal(res.statusCode, 200, res.body);
    const order = res.json();
    assert.equal(order.subtotalCents, 2500 + 2 * 1200);
    assert.equal(order.shippingCents, 899);
    assert.equal(order.taxCents, Math.round(4900 * 0.08));
    assert.equal(order.totalCents, 4900 + 899 + 392);
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.userId, "u1");
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 5, "no stock moves until PAID");
  });

  test("refuses client payment fields (paymentStatus, stripePaymentId) with 400", async () => {
    const { app, prisma } = await buildApp();
    for (const extra of [{ stripePaymentId: "pi_fake" }, { paymentStatus: "PAID" }]) {
      const res = await createOrder(app, as("u1"), extra);
      assert.equal(res.statusCode, 400, JSON.stringify(extra));
    }
    assert.equal((await prisma.shopOrder.findMany()).length, 0);
  });

  test("needs a verified member or guest session; a body userId is not identity", async () => {
    const { app } = await buildApp();
    assert.equal((await createOrder(app, {}, { userId: "u1" })).statusCode, 401);
    const guest = await createOrder(app, { "x-guest-session": "guest-tok" }, { userId: "u1", creditsToApply: 500 });
    assert.equal(guest.statusCode, 200);
    assert.equal(guest.json().userId, null);
    assert.equal(guest.json().guestId, "g1");
    assert.equal(guest.json().creditsApplied, 0, "a guest can't spend a member's credit");
  });

  test("credits are capped by the member's unexpired lots and recorded; the order total is net of them", async () => {
    const { app, prisma } = await buildApp();
    const res = await createOrder(app, as("u1"), { creditsToApply: 1000 });
    const order = res.json();
    assert.equal(order.creditsApplied, 1000);
    assert.equal(order.taxCents, Math.round(3900 * 0.08));
    assert.equal(order.totalCents, 4900 + 899 + 312 - 1000);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000, "recorded, not spent");
    assert.equal((await createOrder(app, as("u1"), { creditsToApply: 99999, items: [{ productId: "bowl", quantity: 3 }] })).json().creditsApplied, 3000, "capped by the lots");
  });

  test("an abandoned order spends nothing: no credit, no gift card balance, no stock", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { app } = await buildApp(prisma);
    const order = (await createOrder(app, as("u1"), { creditsToApply: 1000, giftCardCode: "aaaabbbbccccdddd" })).json();
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.creditsApplied, 1000);
    assert.equal(order.giftCardApplied, 1000);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000);
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 1000);
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 5);
    assert.equal((await prisma.creditEvent.findMany()).length, 0);
  });

  test("a bare gift card id is not accepted (the code is the credential)", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { app } = await buildApp(prisma);
    assert.equal((await createOrder(app, as("u1"), { giftCardId: "gc1" })).json().giftCardApplied, 0);
    assert.equal((await createOrder(app, as("u2"), { giftCardCode: "NOPE" })).statusCode, 400);
  });

  test("reloading checkout reuses the owner's unpaid order for the same cart and savings", async () => {
    // Real clock: the in-memory store stamps createdAt with the wall clock, and reuse is limited to a day.
    const { app, prisma } = await buildApp(seedShop({ creditLots: [{ id: "lot1", userId: "u1", source: "CASHBACK", amountCents: 3000, remainingCents: 3000, expiresAt: new Date(Date.now() + 30 * DAY) }] }), fakeStripe(), { clock: () => new Date() });
    const a = (await createOrder(app, as("u1"), { creditsToApply: 500 })).json();
    const b = (await createOrder(app, as("u1"), { creditsToApply: 500, shipping: { name: "New Name" } })).json();
    assert.equal(b.id, a.id);
    assert.equal(b.shippingName, "New Name");
    const c = (await createOrder(app, as("u1"), { creditsToApply: 600 })).json();
    assert.notEqual(c.id, a.id, "different savings: a new order");
    const d = (await createOrder(app, as("u2"), { creditsToApply: 500 })).json();
    assert.notEqual(d.id, a.id, "another owner never shares an order");
    assert.equal((await prisma.shopOrder.findMany()).length, 3);
  });

  test("savings that cover everything make the order PAID (server-verified zero balance)", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 10000, balanceCents: 10000, status: "ACTIVE" }] });
    const { app, paidCalls } = await buildApp(prisma);
    const res = await createOrder(app, as("u2"), { giftCardCode: "AAAA-BBBB-CCCC-DDDD" });
    const order = res.json();
    assert.equal(order.totalCents, 0);
    assert.equal(order.giftCardApplied, 4900 + 899);
    assert.equal(order.paymentStatus, "PAID");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 10000 - 5799);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(paidCalls, [order.id]);
  });
});

describe("shop PaymentIntent (POST /create-payment-intent kind shop_order)", () => {
  test("the amount is the server's amount due; metadata { shopOrderId, kind: 'shop' }", async () => {
    const { app, stripe } = await buildApp();
    const order = (await createOrder(app)).json();
    const res = await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u1"), payload: { kind: "shop_order", shopOrderId: order.id } });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().amountCents, order.totalCents);
    assert.equal(stripe.created.length, 1);
    assert.equal(stripe.created[0].amount, 6191);
    assert.equal(stripe.created[0].metadata.shopOrderId, order.id);
    assert.equal(stripe.created[0].metadata.kind, "shop");
    assert.equal(stripe.created[0].metadata.orderId, undefined, "never looks like a food order to the webhook");
  });

  test("a client amountCents is refused with 400 and nothing is created", async () => {
    const { app, stripe } = await buildApp();
    const order = (await createOrder(app)).json();
    for (const payload of [
      { kind: "shop_order", shopOrderId: order.id, amountCents: 100 },
      { amountCents: 100, metadata: { type: "shop_order", shopOrderId: order.id } },
      { kind: "shop_order_instore", shopOrderId: order.id, amountCents: 6191 },
    ]) {
      const res = await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u1"), payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
      assert.equal(res.json().error, "AMOUNT_NOT_ALLOWED");
    }
    assert.equal(stripe.created.length, 0);
  });

  test("only the order's owner (or guest session) may create it", async () => {
    const { app, stripe } = await buildApp();
    const order = (await createOrder(app)).json();
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", payload: { kind: "shop_order", shopOrderId: order.id } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u2"), payload: { kind: "shop_order", shopOrderId: order.id } })).statusCode, 403);
    const guestOrder = (await createOrder(app, { "x-guest-session": "guest-tok" })).json();
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", headers: { "x-guest-session": "nope" }, payload: { kind: "shop_order", shopOrderId: guestOrder.id } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", headers: { "x-guest-session": "guest-tok" }, payload: { kind: "shop_order", shopOrderId: guestOrder.id } })).statusCode, 200);
    assert.equal(stripe.created.length, 1);
  });
});

describe("PATCH /shop/orders/:id", () => {
  test("paymentStatus, totals and unknown fields are 400; fulfillment fields still update", async () => {
    const { app, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    for (const payload of [{ paymentStatus: "PAID" }, { stripePaymentId: "pi_x" }, { totalCents: 0 }, { creditsApplied: 99999 }, { fulfillmentStatus: "SHIPPED", paymentStatus: "PAID" }, { bogus: 1 }]) {
      const res = await app.inject({ method: "PATCH", url: `/shop/orders/${order.id}`, payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal(row.totalCents, 6191);
    assert.equal(row.fulfillmentStatus, "PENDING");
    const ok = await app.inject({ method: "PATCH", url: `/shop/orders/${order.id}`, payload: { fulfillmentStatus: "PROCESSING", trackingNumber: "1Z" } });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().fulfillmentStatus, "PROCESSING");
  });
});

describe("POST /shop/orders/:id/confirm-payment", () => {
  async function paidIntent(app, stripe, order, overrides = {}) {
    const pi = await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u1"), payload: { kind: "shop_order", shopOrderId: order.id } });
    const id = pi.json().id;
    Object.assign(stripe.intents[id], { status: "succeeded" }, overrides);
    return id;
  }

  test("a mismatched amount is 402, the order stays unpaid, and the charge is refunded", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    const piId = await paidIntent(app, stripe, order, { amount: 100 });
    const res = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: as("u1"), payload: { paymentIntentId: piId } });
    assert.equal(res.statusCode, 402);
    assert.equal(res.json().refunded, true);
    assert.equal((await prisma.shopOrder.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("another order's PaymentIntent, or an unfinished one, doesn't pay", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    const other = (await createOrder(app, as("u1"), { creditsToApply: 100 })).json();
    const otherPi = await paidIntent(app, stripe, other);
    const pending = (await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u1"), payload: { kind: "shop_order", shopOrderId: order.id } })).json().id;
    for (const paymentIntentId of [otherPi, pending, "pi_missing"]) {
      const res = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: as("u1"), payload: { paymentIntentId } });
      assert.equal(res.statusCode, 402, paymentIntentId);
    }
    assert.equal((await prisma.shopOrder.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("success is idempotent: the return page and the webhook (ADMIN_API_KEY) both confirm, PAID once", async () => {
    const { app, stripe, prisma, paidCalls } = await buildApp();
    const order = (await createOrder(app)).json();
    const piId = await paidIntent(app, stripe, order);
    const first = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: as("u1"), payload: { paymentIntentId: piId } });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().alreadyPaid, false);
    assert.equal(first.json().paymentStatus, "PAID");
    const hook = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: SERVICE, payload: { paymentIntentId: piId } });
    assert.equal(hook.statusCode, 200);
    assert.equal(hook.json().alreadyPaid, true);
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PAID");
    assert.equal(row.stripePaymentId, piId);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(paidCalls, [order.id], "paid effects run once");
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("callers other than the owner, the guest session or the webhook are refused", async () => {
    const { app, stripe } = await buildApp();
    const order = (await createOrder(app)).json();
    const piId = await paidIntent(app, stripe, order);
    assert.equal((await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, payload: { paymentIntentId: piId } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: as("u2"), payload: { paymentIntentId: piId } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: { "x-admin-api-key": "wrong" }, payload: { paymentIntentId: piId } })).statusCode, 401);
  });
});

describe("POST /shop/orders/:id/apply-credits", () => {
  test("a PAID order answers 409 ORDER_NOT_PENDING and nothing is spent", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    const pi = (await app.inject({ method: "POST", url: "/create-payment-intent", headers: as("u1"), payload: { kind: "shop_order", shopOrderId: order.id } })).json().id;
    stripe.intents[pi].status = "succeeded";
    await app.inject({ method: "POST", url: `/shop/orders/${order.id}/confirm-payment`, headers: as("u1"), payload: { paymentIntentId: pi } });
    const res = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/apply-credits`, headers: as("u1"), payload: { amountCents: 500 } });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "ORDER_NOT_PENDING");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000);
  });

  test("a cancelled order answers 409 too", async () => {
    const { app, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    await prisma.shopOrder.update({ where: { id: order.id }, data: { fulfillmentStatus: "CANCELLED" } });
    const res = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/apply-credits`, headers: as("u1"), payload: { amountCents: 500 } });
    assert.equal(res.statusCode, 409);
  });

  test("a double apply doesn't double-spend: concurrent calls spend at most what the order can take", async () => {
    const { app, prisma } = await buildApp();
    const order = (await createOrder(app)).json(); // owes 4900 + 899 + 392
    const room = 4900 + 899; // savings beyond this only zero the tax
    const calls = await Promise.all([1, 2].map(() => app.inject({ method: "POST", url: `/shop/orders/${order.id}/apply-credits`, headers: as("u1"), payload: { amountCents: 3000 } })));
    const codes = calls.map((c) => c.statusCode).sort();
    assert.deepEqual(codes, [200, 400], calls.map((c) => c.body).join(" | "));
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.creditsApplied, 3000, "the lot only held 3000; the second call found nothing left");
    assert.ok(row.creditsApplied <= room);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000, "recorded, spent only at PAID");
    assert.equal(row.totalCents, shopAmountDue(row, await prisma.shopOrderItem.findMany({ where: { orderId: order.id } })));
  });

  test("a stale read can't double-spend: the conditional update refuses (ORDER_CHANGED) and rolls the spend back", async () => {
    const prisma = seedShop();
    const { app } = await buildApp(prisma);
    const order = (await createOrder(app)).json();
    // Simulate a concurrent apply landing between this call's read and its write.
    const wrapped = {
      ...prisma,
      $transaction: (fn) => prisma.$transaction(async (tx) => {
        const origFind = tx.shopOrder.findUnique.bind(tx.shopOrder);
        tx.shopOrder.findUnique = async (args) => {
          const row = await origFind(args);
          await tx.shopOrder.update({ where: { id: order.id }, data: { creditsApplied: 1 } });
          tx.shopOrder.findUnique = origFind;
          return row;
        };
        return fn(tx);
      }),
    };
    await assert.rejects(applyShopCredits(wrapped, { orderId: order.id, userId: "u1", amountCents: 500, now: NOW }), (e) => e.code === "ORDER_CHANGED");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000);
    assert.equal((await prisma.shopOrder.findUnique({ where: { id: order.id } })).creditsApplied, 0);
  });

  test("covering the rest makes it PAID; a repeat then gets 409", async () => {
    const prisma = seedShop({ creditLots: [{ id: "lot1", userId: "u1", source: "CASHBACK", amountCents: 9000, remainingCents: 9000, expiresAt: new Date(NOW.getTime() + 30 * DAY) }] });
    const { app } = await buildApp(prisma);
    const order = (await createOrder(app)).json();
    const first = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/apply-credits`, headers: as("u1"), payload: { amountCents: 9000 } });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().creditsApplied, 5799);
    assert.equal(first.json().newTotal, 0);
    assert.equal(first.json().paymentStatus, "PAID");
    const again = await app.inject({ method: "POST", url: `/shop/orders/${order.id}/apply-credits`, headers: as("u1"), payload: { amountCents: 9000 } });
    assert.equal(again.statusCode, 409);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 9000 - 5799);
  });
});

describe("fix round 1: savings and stock are spent only when the order becomes PAID", () => {
  test("confirm spends the recorded credits, gift card and stock exactly once", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { app, stripe } = await buildApp(prisma);
    const order = (await createOrder(app, as("u1"), { creditsToApply: 1000, giftCardCode: "AAAA-BBBB-CCCC-DDDD" })).json();
    const pi = await payIntent(app, stripe, order);
    assert.equal(stripe.created[0].amount, order.totalCents);
    assert.equal((await confirm(app, order, pi)).statusCode, 200);
    assert.equal((await confirm(app, order, pi, SERVICE)).json().alreadyPaid, true);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000);
    const card = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.deepEqual([card.balanceCents, card.status], [0, "EXHAUSTED"]);
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 4);
    const events = await prisma.creditEvent.findMany();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].metadata, { shopOrderId: order.id });
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("credits short at confirm: 409 CREDIT_SHORT, a FULL refund, the order stays PENDING and nothing is spent", async () => {
    const { app, stripe, prisma, paidCalls } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 2000 })).json();
    const pi = await payIntent(app, stripe, order);
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 500 } }); // spent elsewhere meanwhile
    const res = await confirm(app, order, pi);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "CREDIT_SHORT");
    assert.equal(res.json().refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.deepEqual(Object.keys(stripe.refundCalls[0][0]), ["payment_intent"], "full refund: no amount");
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 500);
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 5, "stock rolled back too");
    const cases = await prisma.supportCase.findMany();
    assert.equal(cases.length, 1);
    assert.match(cases[0].summary, new RegExp(order.orderNumber));
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(paidCalls, []);
  });

  test("stock short at confirm: 409 OUT_OF_STOCK and a full refund", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app)).json();
    const pi = await payIntent(app, stripe, order);
    await prisma.shopProduct.update({ where: { id: "p_bowl" }, data: { stockCount: 0 } });
    const res = await confirm(app, order, pi);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, "OUT_OF_STOCK");
    assert.equal(res.json().refunded, true);
    assert.equal((await prisma.shopOrder.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("gift card spent elsewhere before confirm: 409 GIFT_CARD_CHANGED and a full refund", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { app, stripe } = await buildApp(prisma);
    const order = (await createOrder(app, as("u2"), { giftCardCode: "AAAA-BBBB-CCCC-DDDD" })).json();
    const pi = await payIntent(app, stripe, order, as("u2"));
    await prisma.giftCard.update({ where: { id: "gc1" }, data: { balanceCents: 200 } });
    const res = await confirm(app, order, pi, as("u2"));
    assert.deepEqual([res.statusCode, res.json().error, res.json().refunded], [409, "GIFT_CARD_CHANGED", true]);
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 200);
  });

  test("two concurrent confirms of the same PaymentIntent: PAID once, spent once, no refund, one paid effect", async () => {
    const { app, stripe, prisma, paidCalls } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 1000 })).json();
    const pi = await payIntent(app, stripe, order);
    const [a, b] = await Promise.all([confirm(app, order, pi), confirm(app, order, pi, SERVICE)]);
    assert.deepEqual([a.statusCode, b.statusCode], [200, 200], a.body + b.body);
    assert.deepEqual([a.json().alreadyPaid, b.json().alreadyPaid].sort(), [false, true]);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000);
    assert.equal(stripe.refundCalls.length, 0);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(paidCalls, [order.id]);
  });

  test("two different succeeded PaymentIntents confirmed at once: spent exactly once, at most one refunded", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 1000 })).json();
    const pi1 = await payIntent(app, stripe, order);
    const pi2 = await payIntent(app, stripe, order);
    const results = await Promise.all([confirm(app, order, pi1), confirm(app, order, pi2)]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PAID");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000);
    assert.equal(stripe.refundCalls.length, 1);
    assert.notEqual(stripe.refundCalls[0][0].payment_intent, row.stripePaymentId, "the applied charge is never refunded");
  });
});

describe("admin payment corrections are recorded (fix round 1)", () => {
  test("paymentAuditNotes appends who changed paymentStatus / stripePaymentId, and nothing otherwise", () => {
    const at = new Date("2026-10-01T18:00:00Z");
    const existing = { paymentStatus: "PENDING", stripePaymentId: null, adminNotes: "called customer" };
    assert.equal(paymentAuditNotes(existing, { fulfillmentStatus: "SHIPPED" }, { at }), null);
    assert.equal(paymentAuditNotes(existing, { paymentStatus: "PENDING" }, { at }), null);
    assert.equal(
      paymentAuditNotes(existing, { paymentStatus: "PAID" }, { adminUserId: "user_abc", adminRole: "manager", at }),
      "called customer\n[2026-10-01T18:00:00.000Z] paymentStatus PENDING -> PAID by admin user_abc (manager)",
    );
    assert.equal(
      paymentAuditNotes({ paymentStatus: "PAID", stripePaymentId: "pi_1" }, { paymentStatus: "REFUNDED", stripePaymentId: null, adminNotes: "cash refund" }, { adminRole: "owner", at }),
      "cash refund\n[2026-10-01T18:00:00.000Z] paymentStatus PAID -> REFUNDED, stripePaymentId pi_1 -> none by admin (API key or dev) (owner)",
    );
  });
});

describe("fix round 2", () => {
  const LEGACY = {
    id: "so_legacy",
    orderNumber: "SHOP-MK1ABC-XY12", // pre-D10a: savings and stock were spent at creation
    userId: "u1",
    subtotalCents: 4900,
    shippingCents: 899,
    taxCents: Math.round((4900 - 1000 - 500) * 0.08),
    totalCents: 4900 + 899 + Math.round((4900 - 1000 - 500) * 0.08) - 1500,
    creditsApplied: 1000,
    giftCardApplied: 500,
    giftCardId: "gc1",
    fulfillmentType: "SHIPPING",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING",
  };
  const legacyPrisma = () => seedShop({
    giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 500, status: "ACTIVE" }],
    shopOrders: [{ ...LEGACY }],
    shopOrderItems: [
      { id: "li1", orderId: "so_legacy", productId: "p_bowl", quantity: 1, priceCents: 2500 },
      { id: "li2", orderId: "so_legacy", productId: "p_sticks", quantity: 2, priceCents: 1200 },
    ],
  });
  const untouched = async (prisma) => {
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000, "credits not spent again");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 500, "gift card not debited again");
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 5, "stock not decremented again");
  };

  test("new orders carry the SO- prefix that marks spend-at-PAID", async () => {
    const { app } = await buildApp();
    assert.match((await createOrder(app)).json().orderNumber, /^SO-/);
  });

  test("a legacy (SHOP-) order confirmed by card is PAID without spending its savings a second time", async () => {
    const stripe = fakeStripe({ pi_legacy: { status: "succeeded", amount: LEGACY.totalCents, metadata: { shopOrderId: "so_legacy", kind: "shop" } } });
    const prisma = legacyPrisma();
    const res = await confirmShopPayment(prisma, stripe, { orderId: "so_legacy", paymentIntentId: "pi_legacy", now: NOW });
    assert.equal(res.order.paymentStatus, "PAID");
    await untouched(prisma);
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("a legacy order marked PAID by staff spends nothing; apply-credits refuses it", async () => {
    const prisma = legacyPrisma();
    const res = await markShopOrderPaidByStaff(prisma, { orderId: "so_legacy", now: NOW });
    assert.equal(res.order.paymentStatus, "PAID");
    await untouched(prisma);
    const other = legacyPrisma();
    await assert.rejects(applyShopCredits(other, { orderId: "so_legacy", userId: "u1", amountCents: 100, now: NOW }), (e) => e.code === "LEGACY_ORDER" && e.status === 409);
  });

  test("staff manual PAID runs the same settle: credits, gift card and stock are spent once", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { app } = await buildApp(prisma);
    const order = (await createOrder(app, as("u1"), { creditsToApply: 1000, giftCardCode: "AAAA-BBBB-CCCC-DDDD" })).json();
    const res = await markShopOrderPaidByStaff(prisma, { orderId: order.id, stripePaymentId: "pi_manual", now: NOW });
    assert.equal(res.order.paymentStatus, "PAID");
    assert.equal(res.order.stripePaymentId, "pi_manual");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000);
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 0);
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 4);
    assert.equal((await markShopOrderPaidByStaff(prisma, { orderId: order.id, now: NOW })).alreadyPaid, true);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000, "not spent twice");
  });

  test("staff manual PAID with a shortfall: 409 with a message for the admin, nothing changes", async () => {
    const { app, prisma } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 2000 })).json();
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 100 } });
    await assert.rejects(markShopOrderPaidByStaff(prisma, { orderId: order.id, now: NOW }), (e) => e.status === 409 && e.code === "CREDIT_SHORT" && /remove savings first/.test(e.message));
    const row = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 5);
    await prisma.shopProduct.update({ where: { id: "p_bowl" }, data: { stockCount: 0 } });
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 3000 } });
    await assert.rejects(markShopOrderPaidByStaff(prisma, { orderId: order.id, now: NOW }), (e) => e.code === "OUT_OF_STOCK" && /restock/.test(e.message));
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000);
  });

  test("a refunded PaymentIntent can't confirm the order again, even once the shortfall is gone", async () => {
    const { app, stripe, prisma, paidCalls } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 2000 })).json();
    const pi = await payIntent(app, stripe, order);
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 500 } });
    assert.equal((await confirm(app, order, pi)).statusCode, 409);
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 3000 } });
    for (const headers of [as("u1"), SERVICE]) {
      const again = await confirm(app, order, pi, headers);
      assert.equal(again.statusCode, 409);
      assert.equal(again.json().error, "PAYMENT_REFUNDED");
    }
    assert.equal((await prisma.shopOrder.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 3000);
    assert.equal(stripe.refundCalls.length, 1);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(paidCalls, []);
  });

  test("a gift card that expired after checkout doesn't pay: 409 GIFT_CARD_CHANGED and a full refund", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE", expiresAt: new Date(NOW.getTime() + DAY) }] });
    const later = new Date(NOW.getTime() + 2 * DAY);
    let clock = NOW;
    const { app, stripe } = await buildApp(prisma, fakeStripe(), { clock: () => clock });
    const order = (await createOrder(app, as("u2"), { giftCardCode: "AAAA-BBBB-CCCC-DDDD" })).json();
    const pi = await payIntent(app, stripe, order, as("u2"));
    clock = later;
    const res = await confirm(app, order, pi, as("u2"));
    assert.deepEqual([res.statusCode, res.json().error, res.json().refunded], [409, "GIFT_CARD_CHANGED", true]);
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 1000);
  });

  test("when the re-read after a failed settle fails, nothing is refunded and a NEEDS_REVIEW case names the SHOP order", async () => {
    const { app, stripe, prisma } = await buildApp();
    const order = (await createOrder(app, as("u1"), { creditsToApply: 2000 })).json();
    const pi = await payIntent(app, stripe, order);
    await prisma.creditLot.update({ where: { id: "lot1" }, data: { remainingCents: 100 } });
    let reads = 0;
    const flaky = new Proxy(prisma, {
      get(target, prop) {
        if (prop !== "shopOrder") return target[prop];
        return new Proxy(target.shopOrder, {
          get(t, p2) {
            if (p2 !== "findUnique") return t[p2];
            return async (args) => {
              reads += 1;
              if (reads === 2) throw new Error("db down");
              return t.findUnique(args);
            };
          },
        });
      },
    });
    await assert.rejects(confirmShopPayment(flaky, stripe, { orderId: order.id, paymentIntentId: pi, now: NOW }), (e) => e.code === "CREDIT_SHORT");
    assert.equal(stripe.refundCalls.length, 0);
    const cases = await prisma.supportCase.findMany();
    assert.equal(cases.length, 1);
    assert.match(cases[0].summary, /^NEEDS_REVIEW/);
    assert.match(cases[0].summary, new RegExp(`SHOP order ${order.orderNumber}.*not a food order`));
  });

  test("reuse matches the pickup location and never rewrites a paid order", async () => {
    const { app, prisma } = await buildApp(seedShop({ creditLots: [] }), fakeStripe(), { clock: () => new Date() });
    const pickup = (loc) => createOrder(app, as("u2"), { fulfillmentType: "IN_STORE_PICKUP", locationId: loc });
    const a = (await pickup("L1")).json();
    assert.equal((await pickup("L1")).json().id, a.id);
    assert.notEqual((await pickup("L2")).json().id, a.id, "another location: a new order");
    await prisma.shopOrder.update({ where: { id: a.id }, data: { paymentStatus: "PAID" } });
    const c = (await pickup("L1")).json();
    assert.notEqual(c.id, a.id);
  });
});
