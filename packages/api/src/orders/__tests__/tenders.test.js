import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { createGiftCard, createMealGift } from "../tenders.js";
import { quoteOrder, createOrder, markPaid } from "../service.js";

let n = 0;
const generateCode = () => `CODE-${String(++n).padStart(4, "0")}-AAAA-BBBB`;
const EXPIRES = new Date(NOW.getTime() + 8 * HOUR_MS);

async function payWith(prisma, { giftCardCode, mealGiftId }) {
  const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", giftCardCode, mealGiftId, now: NOW });
  const order = await createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", userId: "u1", now: NOW, isDineInOrdersEnabled: () => true });
  return { quote, order };
}

describe("gift cards need verified funding", () => {
  test("no PaymentIntent, or one that didn't succeed, is for another amount, or isn't a gift-card purchase: no card", async () => {
    const prisma = seed();
    const stripe = fakeStripe({
      pi_pending: { status: "requires_payment_method", amount: 2500, metadata: { type: "gift_card", amountCents: "2500" } },
      pi_short: { status: "succeeded", amount: 1000, metadata: { type: "gift_card", amountCents: "1000" } },
      pi_shop: { status: "succeeded", amount: 2500, metadata: { type: "shop_order" } },
    });
    await assert.rejects(createGiftCard(prisma, stripe, { amountCents: 2500, generateCode }), (e) => e.status === 402);
    for (const stripePaymentId of ["pi_pending", "pi_short", "pi_shop", "pi_missing"]) {
      await assert.rejects(createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId, generateCode }), (e) => e.status === 402, stripePaymentId);
    }
    assert.equal((await prisma.giftCard.findMany()).length, 0);
  });

  test("a funded card is ACTIVE, pays for food, and its PaymentIntent can't buy a second card", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_card: { status: "succeeded", amount: 2500, metadata: { type: "gift_card", amountCents: "2500" } } });
    const card = await createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId: "pi_card", purchaserId: "u2", generateCode });
    assert.equal(card.status, "ACTIVE");
    assert.equal(card.balanceCents, 2500);
    await assert.rejects(createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId: "pi_card", generateCode }), (e) => e.code === "PAYMENT_ALREADY_USED");

    const { order } = await payWith(prisma, { giftCardCode: card.code });
    assert.equal(order.amountDueCents, 0);
    const res = await markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects);
    assert.equal(res.order.paymentStatus, "PAID");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: card.id } })).balanceCents, 2500 - 1924);
  });

  test("trusted (server-to-server) issuing needs no PaymentIntent", async () => {
    const prisma = seed();
    const card = await createGiftCard(prisma, fakeStripe(), { amountCents: 1000, trusted: true, generateCode });
    assert.equal(card.status, "ACTIVE");
  });

  test("amount limits", async () => {
    const prisma = seed();
    await assert.rejects(createGiftCard(prisma, fakeStripe(), { amountCents: 999, trusted: true, generateCode }), (e) => e.status === 400);
    await assert.rejects(createGiftCard(prisma, fakeStripe(), { amountCents: 50001, trusted: true, generateCode }), (e) => e.status === 400);
  });
});

describe("meal gifts need verified funding from the verified giver", () => {
  const META = { type: "meal_gift", giverId: "u2", locationId: "L1" };

  test("unfunded, underpaid, or someone else's PaymentIntent: no gift", async () => {
    const prisma = seed();
    const stripe = fakeStripe({
      pi_pending: { status: "processing", amount: 2000, metadata: META },
      pi_low: { status: "succeeded", amount: 500, metadata: META },
      pi_other: { status: "succeeded", amount: 2000, metadata: { ...META, giverId: "u1" } },
    });
    await assert.rejects(createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2000, expiresAt: EXPIRES, now: NOW }), (e) => e.status === 402);
    for (const paymentIntentId of ["pi_pending", "pi_low", "pi_other"]) {
      await assert.rejects(createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2000, paymentIntentId, expiresAt: EXPIRES, now: NOW }), (e) => e.status === 402, paymentIntentId);
    }
    assert.equal((await prisma.mealGift.findMany()).length, 0);
    // The underpaid charge was ours and succeeded: refunded in full.
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: "pi_low" }]);
  });

  test("a funded gift records paidAt, reduces the amount due, and is consumed at PAID", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 2000, metadata: META } });
    const gift = await createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW });
    assert.ok(gift.paidAt);
    assert.equal(gift.stripePaymentIntentId, "pi_gift");
    await assert.rejects(createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW }), (e) => e.code === "PAYMENT_ALREADY_USED");

    const { order } = await payWith(prisma, { mealGiftId: gift.id });
    assert.equal(order.amountDueCents, 0);
    await markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects);
    assert.equal((await prisma.mealGift.findUnique({ where: { id: gift.id } })).status, "ACCEPTED");
  });
});
