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
  isServiceCall: () => false,
};

async function buildApp() {
  const prisma = seed({ giftCards: [{ ...CARD }] });
  const app = Fastify({ logger: false });
  await registerGiftCardRoutes(app, { prisma, stripe: fakeStripe(), customerAuth: fakeCustomerAuth });
  await app.ready();
  return { app, prisma };
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

  test("purchase without a verified PaymentIntent is refused (402) and the webhook confirm needs a matching one", async () => {
    const { app } = await buildApp();
    const buy = await app.inject({ method: "POST", url: "/gift-cards", payload: { amountCents: 2500 } });
    assert.equal(buy.statusCode, 402);
    const hook = await app.inject({ method: "POST", url: "/gift-cards/gc1/confirm-payment", payload: { stripePaymentId: "pi_nope" } });
    assert.equal(hook.statusCode, 402);
  });
});
