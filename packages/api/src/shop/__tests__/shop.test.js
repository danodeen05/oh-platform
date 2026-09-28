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
import { shopTotals, shopAmountDue, applyShopCredits } from "../service.js";

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

async function buildApp(prisma = seedShop(), stripe = fakeStripe()) {
  const app = Fastify({ logger: false });
  const paidCalls = [];
  const { shopOrderAccess } = await registerShopOrderRoutes(app, {
    prisma,
    stripe,
    customerAuth: fakeCustomerAuth,
    onShopOrderPaid: async (order) => paidCalls.push(order.id),
    now: () => NOW,
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
    assert.equal((await prisma.shopProduct.findUnique({ where: { id: "p_bowl" } })).stockCount, 4);
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

  test("credits come from the member's unexpired lots, in the same transaction", async () => {
    const { app, prisma } = await buildApp();
    const res = await createOrder(app, as("u1"), { creditsToApply: 1000 });
    const order = res.json();
    assert.equal(order.creditsApplied, 1000);
    assert.equal(order.taxCents, Math.round(3900 * 0.08));
    assert.equal(order.totalCents, 4900 + 899 + 312 - 1000);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 2000);
    const events = await prisma.creditEvent.findMany();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].metadata, { shopOrderId: order.id });
  });

  test("savings that cover everything make the order PAID (server-verified zero balance)", async () => {
    const prisma = seedShop({ giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 10000, balanceCents: 10000, status: "ACTIVE" }] });
    const { app, paidCalls } = await buildApp(prisma);
    const res = await createOrder(app, as("u2"), { giftCardId: "gc1" });
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
    const other = (await createOrder(app)).json();
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
    const lot = await prisma.creditLot.findUnique({ where: { id: "lot1" } });
    assert.equal(lot.remainingCents, 0);
    assert.equal(3000 - lot.remainingCents, row.creditsApplied, "spent exactly what the order records");
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
