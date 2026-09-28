/**
 * Task A7 fix rounds 1 and 2: gift card value is only ever spent as checkout
 * tender from the card's own, non-expiring balance. There is no route that
 * drains a card (apply) or turns its value into expiring credit (redeem).
 * Real Fastify injects against the plugin index.js registers.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerGiftCardRoutes } from "../gift-card-routes.js";
import { seed, fakeStripe, NOW, CLASSIC_BOWL } from "./fixtures.js";
import { quoteOrder } from "../service.js";
import { registerPurchaseIntentRoute } from "../purchase-intents.js";

const CARD = { id: "gc1", code: "GIFT-AAAA-BBBB-CCCC", amountCents: 2500, balanceCents: 2500, status: "ACTIVE", designId: "d1" };

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

async function buildApp(stripe = fakeStripe()) {
  const prisma = seed({ giftCards: [{ ...CARD }] });
  const app = Fastify({ logger: false });
  const emails = [];
  await registerGiftCardRoutes(app, { prisma, stripe, customerAuth: fakeCustomerAuth, sendGiftCardEmail: async (card) => emails.push(card.id) });
  registerPurchaseIntentRoute(app, { prisma, stripe, customerAuth: fakeCustomerAuth, shopOrderAccess: async () => ({ status: 403 }) });
  await app.ready();
  return { app, prisma, stripe, emails };
}

describe("gift card routes", () => {
  test("POST /gift-cards/:id/redeem and /apply do not exist (404), even for a signed-in member; the card keeps its balance", async () => {
    const { app, prisma } = await buildApp();
    for (const url of ["/gift-cards/gc1/redeem", "/gift-cards/gc1/apply"]) {
      for (const headers of [{}, { authorization: "Bearer test:u1" }]) {
        const res = await app.inject({ method: "POST", url, headers, payload: { amountCents: 2500, orderId: "o1" } });
        assert.equal(res.statusCode, 404, `${url} ${JSON.stringify(headers)}`);
      }
    }
    const card = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.equal(card.balanceCents, 2500);
    assert.equal(card.status, "ACTIVE");
    assert.equal((await prisma.creditLot.findMany()).length, 0, "no card value became credit");
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 0);
  });

  test("the plugin is live: the code lookup works and the card pays as checkout tender", async () => {
    const { app, prisma } = await buildApp();
    const res = await app.inject({ method: "GET", url: "/gift-cards/code/giftaaaabbbbcccc" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { id: "gc1", balanceCents: 2500, designId: "d1" });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", giftCardCode: "GIFT-AAAA-BBBB-CCCC", now: NOW });
    assert.equal(quote.discounts.giftCardCents, 1924);
    assert.equal(quote.amountDueCents, 0);
  });

  test("purchase without a verified PaymentIntent is refused (402); the old :id webhook route is gone", async () => {
    const { app } = await buildApp();
    const buy = await app.inject({ method: "POST", url: "/gift-cards", payload: { amountCents: 2500 } });
    assert.equal(buy.statusCode, 402);
    const old = await app.inject({ method: "POST", url: "/gift-cards/gc1/confirm-payment", headers: { "x-admin-api-key": "svc" }, payload: { stripePaymentId: "pi_nope" } });
    assert.equal(old.statusCode, 404);
  });
});

describe("gift card purchase integrity (Task D10a)", () => {
  test("the PaymentIntent amount is the validated face value: $5 and $600 are 400, non-integers too", async () => {
    const { app, stripe } = await buildApp();
    for (const amountCents of [500, 60000, 2500.5, "abc", null]) {
      const res = await app.inject({ method: "POST", url: "/create-payment-intent", payload: { kind: "gift_card", amountCents } });
      assert.equal(res.statusCode, 400, String(amountCents));
    }
    assert.equal(stripe.created.length, 0);
    const ok = await app.inject({ method: "POST", url: "/create-payment-intent", headers: { authorization: "Bearer test:u1" }, payload: { kind: "gift_card", amountCents: 2500, recipientEmail: "r@x.com", recipientName: "Rae", metadata: { type: "gift_card", amountCents: "2500", giftCardId: "forged" } } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(stripe.created[0].amount, 2500);
    assert.deepEqual(stripe.created[0].metadata, { type: "gift_card", amountCents: "2500", purchaserId: "u1", recipientName: "Rae", recipientEmail: "r@x.com" }, "metadata is server-built");
  });

  test("promo codes and store credit are refused with NOT_ALLOWED_FOR_GIFT_CARDS (purchase, PaymentIntent, meal gift PaymentIntent)", async () => {
    const { app, stripe } = await buildApp();
    const cases = [
      ["/gift-cards", { amountCents: 2500, stripePaymentId: "pi_x", promoCodeId: "promo1" }],
      ["/gift-cards", { amountCents: 2500, creditsApplied: 500 }],
      ["/create-payment-intent", { kind: "gift_card", amountCents: 2500, promoCode: "SAVE10" }],
      ["/create-payment-intent", { kind: "gift_card", amountCents: 2500, metadata: { type: "gift_card", creditsApplied: "500" } }],
      ["/create-payment-intent", { kind: "meal_gift", amountCents: 1599, locationId: "L1", useCreditsCents: 500 }],
    ];
    for (const [url, payload] of cases) {
      const res = await app.inject({ method: "POST", url, headers: { authorization: "Bearer test:u1" }, payload });
      assert.equal(res.statusCode, 400, `${url} ${JSON.stringify(payload)}`);
      assert.equal(res.json().error, "NOT_ALLOWED_FOR_GIFT_CARDS");
    }
    assert.equal(stripe.created.length, 0);
    // A zero credit field (old clients) is not a discount.
    const zero = await app.inject({ method: "POST", url: "/create-payment-intent", payload: { kind: "gift_card", amountCents: 2500, metadata: { type: "gift_card", creditsApplied: "0" } } });
    assert.equal(zero.statusCode, 200);
  });

  test("meal gift PaymentIntent: signed in, bound to the verified giver, amount in range", async () => {
    const { app, stripe } = await buildApp();
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", payload: { kind: "meal_gift", amountCents: 1599, locationId: "L1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/create-payment-intent", headers: { authorization: "Bearer test:u1" }, payload: { kind: "meal_gift", amountCents: 100, locationId: "L1" } })).statusCode, 400);
    const ok = await app.inject({ method: "POST", url: "/create-payment-intent", headers: { authorization: "Bearer test:u1" }, payload: { amountCents: 1599, metadata: { type: "meal_gift", giverId: "u2", locationId: "L1" } } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual(stripe.created[0].metadata, { type: "meal_gift", giverId: "u1", locationId: "L1" });
  });

  test("the webhook confirm finds the card by its PaymentIntent, or issues it when the buyer's page never came back", async () => {
    const stripe = fakeStripe();
    const { app, prisma, emails } = await buildApp(stripe);
    const created = await app.inject({ method: "POST", url: "/create-payment-intent", headers: { authorization: "Bearer test:u1" }, payload: { kind: "gift_card", amountCents: 5000, recipientEmail: "r@x.com", recipientName: "Rae", personalMessage: "Enjoy" } });
    const piId = created.json().id;
    stripe.intents[piId].status = "succeeded";

    assert.equal((await app.inject({ method: "POST", url: "/gift-cards/confirm-payment", payload: { paymentIntentId: piId } })).statusCode, 401, "webhook only");

    const hook = await app.inject({ method: "POST", url: "/gift-cards/confirm-payment", headers: { "x-admin-api-key": "svc" }, payload: { paymentIntentId: piId } });
    assert.equal(hook.statusCode, 200, hook.body);
    assert.equal(hook.json().created, true);
    const card = await prisma.giftCard.findUnique({ where: { id: hook.json().giftCardId } });
    assert.equal(card.amountCents, 5000);
    assert.equal(card.balanceCents, 5000);
    assert.equal(card.stripePaymentId, piId);
    assert.equal(card.purchaserId, "u1");
    assert.equal(card.recipientEmail, "r@x.com");
    assert.deepEqual(emails, [card.id]);

    // Redelivery finds the same card; the buyer's page arriving late gets it too.
    const again = await app.inject({ method: "POST", url: "/gift-cards/confirm-payment", headers: { "x-admin-api-key": "svc" }, payload: { paymentIntentId: piId } });
    assert.deepEqual([again.statusCode, again.json().giftCardId, again.json().created], [200, card.id, false]);
    const late = await app.inject({ method: "POST", url: "/gift-cards", headers: { authorization: "Bearer test:u1" }, payload: { amountCents: 5000, stripePaymentId: piId } });
    assert.equal(late.statusCode, 200, late.body);
    assert.equal(late.json().id, card.id);
    const stranger = await app.inject({ method: "POST", url: "/gift-cards", headers: { authorization: "Bearer test:u2" }, payload: { amountCents: 5000, stripePaymentId: piId } });
    assert.equal(stranger.statusCode, 409, "someone else can't claim the card");
    assert.equal((await prisma.giftCard.findMany({ where: { stripePaymentId: piId } })).length, 1);
  });

  test("the webhook confirm issues nothing for an unpaid or non-gift-card PaymentIntent", async () => {
    const stripe = fakeStripe({ pi_open: { status: "requires_payment_method", amount: 2500, metadata: { type: "gift_card", amountCents: "2500" } }, pi_food: { status: "succeeded", amount: 2500, metadata: { orderId: "o1" } } });
    const { app, prisma } = await buildApp(stripe);
    for (const paymentIntentId of ["pi_open", "pi_food", "pi_missing"]) {
      const res = await app.inject({ method: "POST", url: "/gift-cards/confirm-payment", headers: { "x-admin-api-key": "svc" }, payload: { paymentIntentId } });
      assert.equal(res.statusCode, 402, paymentIntentId);
    }
    assert.equal((await prisma.giftCard.findMany()).length, 1, "only the seeded card");
  });
});
