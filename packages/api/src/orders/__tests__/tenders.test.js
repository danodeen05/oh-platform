import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { createGiftCard, createMealGift, acceptMealGift } from "../tenders.js";
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

describe("fix round 2: races", () => {
  test("two concurrent creates with the same verified PaymentIntent give exactly one card", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_card: { status: "succeeded", amount: 2500, metadata: { type: "gift_card", amountCents: "2500" } } });
    const results = await Promise.allSettled([
      createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId: "pi_card", generateCode }),
      createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId: "pi_card", generateCode }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const lost = results.find((r) => r.status === "rejected");
    assert.equal(lost.reason.code, "PAYMENT_ALREADY_USED");
    assert.equal(lost.reason.status, 409);
    assert.equal((await prisma.giftCard.findMany({ where: { stripePaymentId: "pi_card" } })).length, 1);
  });

  function acceptFixture({ challenge = true } = {}) {
    return seed({
      mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 3000, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW, paidAt: NOW, stripePaymentIntentId: "pi_gift" }],
      orders: [
        { id: "o-r1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PAID", status: "QUEUED" },
        { id: "o-r2", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PAID", status: "QUEUED" },
      ],
      challenges: challenge ? [{ id: "ch1", slug: "meal-for-stranger" }] : [],
    });
  }

  for (const challenge of [true, false]) {
    test(`two concurrent accepts of one gift pay out once (challenge row ${challenge ? "present" : "absent"})`, async () => {
      const prisma = acceptFixture({ challenge });
      const accept = (orderId) => acceptMealGift(prisma, { mealGiftId: "mg1", recipientUserId: "u1", orderId, now: NOW });
      const results = await Promise.allSettled([accept("o-r1"), accept("o-r2")]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const lost = results.find((r) => r.status === "rejected");
      assert.equal(lost.reason.status, 409);
      const excess = await prisma.creditEvent.findMany({ where: { type: "GIFT_EXCESS" } });
      assert.equal(excess.length, 1, "one GIFT_EXCESS grant");
      assert.equal(excess[0].amountCents, 3000 - 1924);
      assert.equal((await prisma.creditLot.findMany({ where: { userId: "u1", source: "MEAL_GIFT" } })).length, 1);
      assert.equal((await prisma.creditEvent.findMany({ where: { type: "CHALLENGE_REWARD", userId: "u2" } })).length, 1, "one giver reward");
    });
  }

  test("the giver reward is once per giver even across two gifts (UserChallenge claim)", async () => {
    const prisma = acceptFixture();
    await prisma.mealGift.create({ data: { id: "mg2", giverId: "u2", locationId: "L1", amountCents: 2000, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), paidAt: NOW, stripePaymentIntentId: "pi_gift2" } });
    await Promise.all([
      acceptMealGift(prisma, { mealGiftId: "mg1", recipientUserId: "u1", orderId: "o-r1", now: NOW }),
      acceptMealGift(prisma, { mealGiftId: "mg2", recipientUserId: "u1", orderId: "o-r2", now: NOW }),
    ]);
    assert.equal((await prisma.creditEvent.findMany({ where: { type: "CHALLENGE_REWARD", userId: "u2" } })).length, 1);
    const uc = await prisma.userChallenge.findMany({ where: { userId: "u2", challengeId: "ch1" } });
    assert.equal(uc.length, 1);
    assert.equal(uc[0].rewardClaimed, true);
  });

  test("accept is the caller's own order and a funded gift only", async () => {
    const prisma = acceptFixture();
    await assert.rejects(acceptMealGift(prisma, { mealGiftId: "mg1", recipientUserId: "u2", orderId: "o-r1", now: NOW }), (e) => e.status === 403);
    await prisma.mealGift.update({ where: { id: "mg1" }, data: { paidAt: null } });
    await assert.rejects(acceptMealGift(prisma, { mealGiftId: "mg1", recipientUserId: "u1", orderId: "o-r1", now: NOW }), (e) => e.status === 409);
    assert.equal((await prisma.creditEvent.findMany()).length, 0);
  });
});
