import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { createGiftCard, createMealGift, finishMealGiftAcceptance } from "../tenders.js";
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

  // (A7 fix round 1) POST /meal-gifts/:id/accept is gone; checkout's settle
  // wins the gift claim and then runs finishMealGiftAcceptance. The giver
  // reward is still once per giver across gifts.
  test("the giver reward is once per giver even across two gifts (UserChallenge claim)", async () => {
    const prisma = seed({ challenges: [{ id: "ch1", slug: "meal-for-stranger" }] });
    const gift = (id, amountCents) => ({ id, giverId: "u2", locationId: "L1", amountCents, status: "ACCEPTED", paidAt: NOW });
    await Promise.all([
      finishMealGiftAcceptance(prisma, { mealGift: gift("mg1", 3000), recipientUserId: "u1", appliedCents: 1924, now: NOW }),
      finishMealGiftAcceptance(prisma, { mealGift: gift("mg2", 2000), recipientUserId: "u1", appliedCents: 1924, now: NOW }),
    ]);
    assert.equal((await prisma.creditEvent.findMany({ where: { type: "CHALLENGE_REWARD", userId: "u2" } })).length, 1);
    const uc = await prisma.userChallenge.findMany({ where: { userId: "u2", challengeId: "ch1" } });
    assert.equal(uc.length, 1);
    assert.equal(uc[0].rewardClaimed, true);
    assert.equal((await prisma.creditEvent.findMany({ where: { type: "GIFT_EXCESS" } })).map((e) => e.amountCents).sort((a, b) => a - b).join(","), "76,1076");
  });
});

describe("D9 fix round 1: the giver reward is paid the first time only", () => {
  const gift = (id, amountCents = 2000) => ({ id, giverId: "u2", locationId: "L1", amountCents, status: "ACCEPTED", paidAt: NOW });
  const rewardLots = (prisma) => prisma.creditLot.findMany({ where: { userId: "u2", source: "CHALLENGE" } });

  test("with no Challenge row configured, two concurrent takes and a later third pay $5 exactly once", async () => {
    const prisma = seed();
    const results = await Promise.all([
      finishMealGiftAcceptance(prisma, { mealGift: gift("mg1"), recipientUserId: "u1", appliedCents: 1924, now: NOW }),
      finishMealGiftAcceptance(prisma, { mealGift: gift("mg2"), recipientUserId: "u1", appliedCents: 1924, now: NOW }),
    ]);
    const third = await finishMealGiftAcceptance(prisma, { mealGift: gift("mg3"), recipientUserId: "u1", appliedCents: 1924, now: NOW });
    assert.equal(results.filter((r) => r.giverRewarded).length, 1);
    assert.equal(third.giverRewarded, false);
    const lots = await rewardLots(prisma);
    assert.equal(lots.length, 1);
    assert.equal(lots[0].amountCents, 500);
    // The claim row was created, inactive, so it is never listed.
    const ch = await prisma.challenge.findMany({ where: { slug: "meal-for-stranger" } });
    assert.equal(ch.length, 1);
    assert.equal(ch[0].isActive, false);
    assert.deepEqual(ch[0].requirements, { type: "meal_gift" });
  });

  test("a giver paid under the old every-gift rule (a prior reward lot) is not paid again", async () => {
    const prisma = seed({
      creditLots: [{ id: "old", userId: "u2", source: "CHALLENGE", amountCents: 500, remainingCents: 0, expiresAt: new Date(NOW.getTime() + 30 * 864e5), note: "Meal for a Stranger challenge completed", createdAt: new Date(NOW.getTime() - 864e5) }],
    });
    const r = await finishMealGiftAcceptance(prisma, { mealGift: gift("mg1"), recipientUserId: "u1", appliedCents: 1924, now: NOW });
    assert.equal(r.giverRewarded, false);
    assert.equal((await rewardLots(prisma)).length, 1);
    const uc = await prisma.userChallenge.findMany({ where: { userId: "u2" } });
    assert.equal(uc[0].rewardClaimed, true);
  });
});

describe("D5 fix round 3: a giver can't redeem their own gift", () => {
  test("quoteOrder refuses 400 OWN_GIFT for the giver", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 2000, metadata: { type: "meal_gift", giverId: "u1", locationId: "L1" } } });
    const gift = await createMealGift(prisma, stripe, { giverId: "u1", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW });
    await assert.rejects(
      quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", mealGiftId: gift.id, now: NOW }),
      (e) => e.code === "OWN_GIFT" && e.status === 400,
    );
    assert.equal((await prisma.mealGift.findUnique({ where: { id: gift.id } })).status, "PENDING");
  });

  test("a different member can still redeem it", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 2000, metadata: { type: "meal_gift", giverId: "u1", locationId: "L1" } } });
    const gift = await createMealGift(prisma, stripe, { giverId: "u1", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u2", mealGiftId: gift.id, now: NOW });
    assert.ok(quote.discounts.mealGiftCents > 0);
  });

  test("requoteOrder (savings step, D5) also refuses OWN_GIFT", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 2000, metadata: { type: "meal_gift", giverId: "u1", locationId: "L1" } } });
    const gift = await createMealGift(prisma, stripe, { giverId: "u1", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW });
    const { order } = await payWith(prisma, {});
    const { requoteOrder } = await import("../service.js");
    await assert.rejects(
      requoteOrder(prisma, { orderId: order.id, userId: "u1", changes: { mealGiftId: gift.id }, now: NOW }),
      (e) => e.code === "OWN_GIFT" && e.status === 400,
    );
  });

  test("markPaid still refuses even if a self-gift somehow lands on the order (defense in depth)", async () => {
    const prisma = seed({
      mealGifts: [{ id: "mg1", giverId: "u1", locationId: "L1", amountCents: 2000, status: "PENDING", expiresAt: EXPIRES, createdAt: NOW, paidAt: NOW, stripePaymentIntentId: "pi_gift" }],
    });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", now: NOW }); // no gift on the quote
    const order = await createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", userId: "u1", now: NOW, isDineInOrdersEnabled: () => true });
    // Force the self-gift onto the order directly, bypassing resolveMealGift's check.
    await prisma.order.update({ where: { id: order.id }, data: { mealGiftId: "mg1", mealGiftAppliedCents: 1924, amountDueCents: 0 } });
    await assert.rejects(markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects), (e) => e.code === "MEAL_GIFT_UNAVAILABLE");
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).status, "PENDING");
  });
});

describe("fix round 3: a refunded PaymentIntent funds nothing", () => {
  test("gift card purchase with a refunded (still 'succeeded') PaymentIntent: 409 PAYMENT_REFUNDED, no card, no second refund", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_card: { status: "succeeded", amount: 2500, metadata: { type: "gift_card", amountCents: "2500" } } });
    stripe.issuedRefunds.push({ id: "re_prev", payment_intent: "pi_card" });
    await assert.rejects(createGiftCard(prisma, stripe, { amountCents: 2500, stripePaymentId: "pi_card", generateCode }), (e) => e.code === "PAYMENT_REFUNDED" && e.status === 409);
    assert.equal((await prisma.giftCard.findMany()).length, 0);
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("meal gift funding with a refunded PaymentIntent: 409 PAYMENT_REFUNDED, no gift", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 2000, metadata: { type: "meal_gift", giverId: "u2", locationId: "L1" } } });
    stripe.issuedRefunds.push({ id: "re_prev", payment_intent: "pi_gift" });
    await assert.rejects(createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 2000, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW }), (e) => e.code === "PAYMENT_REFUNDED");
    assert.equal((await prisma.mealGift.findMany()).length, 0);
  });
});

describe("hotfix: a replay of a used payment with changed details never refunds it", () => {
  test("gift card: re-sending a used PaymentIntent with another amount is refused and nothing is refunded", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_card: { status: "succeeded", amount: 50000, metadata: { type: "gift_card", amountCents: "50000" } } });
    const card = await createGiftCard(prisma, stripe, { amountCents: 50000, stripePaymentId: "pi_card", purchaserId: "u2", generateCode });
    await assert.rejects(
      createGiftCard(prisma, stripe, { amountCents: 1000, stripePaymentId: "pi_card", purchaserId: "u2", generateCode }),
      (e) => e.code === "PAYMENT_ALREADY_USED",
    );
    assert.equal(stripe.refundCalls.length, 0, "the card's payment must not be refunded");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: card.id } })).status, "ACTIVE");
  });

  test("meal gift: re-sending a used PaymentIntent with another amount or location is refused and nothing is refunded", async () => {
    const prisma = seed();
    const stripe = fakeStripe({ pi_gift: { status: "succeeded", amount: 3500, metadata: { type: "meal_gift", giverId: "u2", locationId: "L1" } } });
    await createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 3500, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW });
    await assert.rejects(
      createMealGift(prisma, stripe, { giverId: "u2", locationId: "L1", amountCents: 1599, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW }),
      (e) => e.code === "PAYMENT_ALREADY_USED",
    );
    await assert.rejects(
      createMealGift(prisma, stripe, { giverId: "u2", locationId: "L2", amountCents: 3500, paymentIntentId: "pi_gift", expiresAt: EXPIRES, now: NOW }),
      (e) => e.code === "PAYMENT_ALREADY_USED",
    );
    assert.equal(stripe.refundCalls.length, 0, "the gift's payment must not be refunded");
  });
});
