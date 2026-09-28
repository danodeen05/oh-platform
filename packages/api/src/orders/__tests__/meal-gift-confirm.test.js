/**
 * Task D9 fix round 1: a paid meal gift is always recorded. When the giver's
 * tab closes after Stripe confirms, the webhook's POST
 * /meal-gifts/confirm-payment records it from the PaymentIntent's metadata,
 * exactly once, and the giver's own late POST /meal-gifts finds it taken.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerMealGiftConfirm } from "../meal-gift-routes.js";
import { mealGiftMetadata } from "../purchase-intents.js";
import { createMealGift } from "../tenders.js";
import { seed, fakeStripe, NOW } from "./fixtures.js";

const KEY = "svc-key";
const customerAuth = { isServiceCall: (req) => req.headers["x-admin-api-key"] === KEY };
const svc = { "x-admin-api-key": KEY };

function paid(extra = {}) {
  return { status: "succeeded", amount: 2500, metadata: mealGiftMetadata({ giverId: "u2", locationId: "L1", messageFromGiver: "  Enjoy your bowl.  " }), ...extra };
}

async function build(intents) {
  const prisma = seed();
  const stripe = fakeStripe(intents);
  const app = Fastify({ logger: false });
  registerMealGiftConfirm(app, { prisma, stripe, customerAuth, now: () => NOW });
  await app.ready();
  return { app, prisma, stripe };
}

const confirm = (app, paymentIntentId, headers = svc) => app.inject({ method: "POST", url: "/meal-gifts/confirm-payment", headers, payload: { paymentIntentId } });

describe("POST /meal-gifts/confirm-payment (the webhook)", () => {
  test("metadata carries the giver, location and trimmed note", () => {
    assert.deepEqual(mealGiftMetadata({ giverId: "u2", locationId: "L1", messageFromGiver: "  hi " }), { type: "meal_gift", giverId: "u2", locationId: "L1", messageFromGiver: "hi" });
    assert.deepEqual(mealGiftMetadata({ giverId: "u2", locationId: "L1", messageFromGiver: "   " }), { type: "meal_gift", giverId: "u2", locationId: "L1" });
    assert.equal(mealGiftMetadata({ giverId: "u2", locationId: "L1", messageFromGiver: "x".repeat(900) }).messageFromGiver.length, 200);
  });

  test("a confirm after a tab close records exactly one gift, from the PaymentIntent", async () => {
    const { app, prisma } = await build({ pi_gift: paid() });
    const [a, b] = await Promise.all([confirm(app, "pi_gift"), confirm(app, "pi_gift")]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    const again = await confirm(app, "pi_gift");
    assert.equal(again.json().created, false);
    const gifts = await prisma.mealGift.findMany({ where: { stripePaymentIntentId: "pi_gift" } });
    assert.equal(gifts.length, 1);
    const [g] = gifts;
    assert.equal(g.giverId, "u2");
    assert.equal(g.locationId, "L1");
    assert.equal(g.amountCents, 2500);
    assert.equal(g.messageFromGiver, "Enjoy your bowl.");
    assert.equal(g.status, "PENDING");
    assert.ok(g.paidAt);
    // 9pm Denver on NOW's day (NOW is noon MDT on 2026-10-01).
    assert.equal(g.expiresAt.toISOString(), "2026-10-02T03:00:00.000Z");
    assert.equal([a, b].filter((r) => r.json().created).length, 1);
  });

  test("the giver's page arriving later finds the gift already recorded (409 PAYMENT_ALREADY_USED)", async () => {
    const { app, prisma, stripe } = await build({ pi_gift: paid() });
    await confirm(app, "pi_gift");
    await assert.rejects(
      createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2500, paymentIntentId: "pi_gift", expiresAt: NOW, now: NOW }),
      (e) => e.code === "PAYMENT_ALREADY_USED" && e.status === 409,
    );
    assert.equal((await prisma.mealGift.findMany()).length, 1);
  });

  test("service key required; not a meal gift, not succeeded, or refunded: no gift", async () => {
    const { app, prisma, stripe } = await build({
      pi_shop: { status: "succeeded", amount: 2500, metadata: { kind: "shop", shopOrderId: "s1" } },
      pi_pending: paid({ status: "requires_payment_method" }),
      pi_refunded: paid(),
    });
    stripe.issuedRefunds.push({ id: "re_1", payment_intent: "pi_refunded" });
    assert.equal((await confirm(app, "pi_shop", {})).statusCode, 401);
    assert.equal((await confirm(app, "pi_shop")).statusCode, 402);
    assert.equal((await confirm(app, "pi_pending")).statusCode, 402);
    assert.equal((await confirm(app, "pi_refunded")).statusCode, 409);
    assert.equal((await confirm(app, "pi_missing")).statusCode, 402);
    assert.equal((await confirm(app, "")).statusCode, 400);
    assert.equal((await prisma.mealGift.findMany()).length, 0);
  });
});
