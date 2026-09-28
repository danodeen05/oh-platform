/**
 * Task D5 fix round 2: meal-gift pay-forward needs a signed-in caller and
 * records that caller (never a body recipientId); public gift views show
 * "First L." names only, with no user ids or order.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerMealGiftPayForward } from "../meal-gift-routes.js";
import { publicMealGift } from "../meal-gift-view.js";
import { seed, NOW } from "./fixtures.js";

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
const auth = (userId) => ({ authorization: `Bearer test:${userId}` });

function gift(overrides = {}) {
  return { id: "mg1", giverId: "u2", locationId: "L1", amountCents: 1800, payForwardCount: 0, status: "PENDING", paidAt: NOW, expiresAt: new Date(NOW.getTime() + 3600_000), ...overrides };
}

async function buildApp(gifts = [gift()]) {
  const prisma = seed({ mealGifts: gifts, mealGiftChains: [] });
  const app = Fastify({ logger: false });
  registerMealGiftPayForward(app, { prisma, customerAuth: fakeCustomerAuth, now: () => NOW });
  await app.ready();
  return { app, prisma };
}

const payForward = (app, headers = {}, payload = {}) => app.inject({ method: "POST", url: "/meal-gifts/mg1/pay-forward", headers, payload });

describe("POST /meal-gifts/:id/pay-forward", () => {
  test("an anonymous caller is refused and nothing is recorded", async () => {
    const { app, prisma } = await buildApp();
    const res = await payForward(app, {}, { recipientId: "u1" });
    assert.equal(res.statusCode, 401);
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).payForwardCount, 0);
    assert.equal((await prisma.mealGiftChain.findMany({})).length, 0);
  });

  test("a body recipientId naming someone else is a 403", async () => {
    const { app, prisma } = await buildApp();
    const res = await payForward(app, auth("u1"), { recipientId: "u2" });
    assert.equal(res.statusCode, 403);
    assert.equal((await prisma.mealGiftChain.findMany({})).length, 0);
  });

  test("the signed-in caller is the recipient; the message is capped; the reply has no user ids", async () => {
    const { app, prisma } = await buildApp();
    const res = await payForward(app, auth("u1"), { messageFromRecipient: `  ${"x".repeat(400)}  ` });
    assert.equal(res.statusCode, 200);
    const chain = await prisma.mealGiftChain.findMany({});
    assert.equal(chain.length, 1);
    assert.equal(chain[0].recipientId, "u1");
    assert.equal(chain[0].action, "PAID_FORWARD");
    assert.equal(chain[0].messageFromRecipient.length, 280);
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).payForwardCount, 1);
    assert.equal("giverId" in res.json(), false);
  });

  test("a gift that's no longer pending can't be passed on", async () => {
    const { app } = await buildApp([gift({ status: "ACCEPTED" })]);
    assert.equal((await payForward(app, auth("u1"))).statusCode, 400);
  });
});

describe("publicMealGift", () => {
  test("names become First L.; ids, emails and the order are dropped", () => {
    const view = publicMealGift({
      id: "mg1",
      amountCents: 1800,
      giverId: "u2",
      acceptedById: "u3",
      orderId: "o1",
      stripePaymentIntentId: "pi_1",
      giver: { id: "u2", name: "Lin Mei Chen", email: "lin@x.com" },
      acceptedBy: { id: "u3", name: "Sam" },
      order: { id: "o1", orderNumber: "ORD-1" },
      chain: [{ id: "c1", recipientId: "u4", action: "PAID_FORWARD", recipient: { id: "u4", name: "Dana Kim" } }],
    });
    assert.deepEqual(view, {
      id: "mg1",
      amountCents: 1800,
      giver: { name: "Lin C." },
      acceptedBy: { name: "Sam" },
      chain: [{ id: "c1", action: "PAID_FORWARD", recipient: { name: "Dana K." } }],
    });
    assert.equal(JSON.stringify(view).includes("lin@x.com"), false);
  });
});
