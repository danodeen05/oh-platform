import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { readFileSync } from "node:fs";
import { createGiftCard, createMealGift, finishMealGiftAcceptance, redeemGiftCard } from "../tenders.js";
import { availableCredit } from "../../membership/credits.js";
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

describe("A7 fix round 1: the legacy apply and accept routes are gone", () => {
  test("index.js declares neither POST /gift-cards/:id/apply nor POST /meal-gifts/:id/accept (so both are 404)", () => {
    const src = readFileSync(new URL("../../index.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /app\.post\(\s*["'`]\/gift-cards\/:id\/apply["'`]/);
    assert.doesNotMatch(src, /app\.post\(\s*["'`]\/meal-gifts\/:id\/accept["'`]/);
    assert.match(src, /app\.post\(\s*"\/gift-cards\/:id\/redeem"/, "redeem stays");
  });
});

describe("Task A7: /gift-cards/:id/redeem", () => {
  const card = { id: "gc1", code: "GIFT-0001", amountCents: 2500, balanceCents: 2500, status: "ACTIVE" };

  test("only a verified caller; the balance goes to that caller once", async () => {
    const prisma = seed({ giftCards: [{ ...card }] });
    await assert.rejects(redeemGiftCard(prisma, { giftCardId: "gc1", userId: null, now: NOW }), (e) => e.status === 401);
    const results = await Promise.allSettled([
      redeemGiftCard(prisma, { giftCardId: "gc1", userId: "u1", now: NOW }),
      redeemGiftCard(prisma, { giftCardId: "gc1", userId: "u2", now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
    const row = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.equal(row.status, "REDEEMED");
    assert.equal(row.balanceCents, 0);
    const winner = results.find((r) => r.status === "fulfilled").value;
    assert.equal(winner.creditsAdded, 2500);
    const credited = await prisma.user.findUnique({ where: { id: row.redeemedById } });
    assert.equal(credited.creditsCents, 2500);
    assert.equal((await prisma.creditEvent.findMany()).length, 1);
  });

  test("fix round 1: a redeem is a GIFT_CARD credit lot; availableCredit equals the cached balance and checkout can spend it", async () => {
    const prisma = seed({ giftCards: [{ ...card }] });
    await redeemGiftCard(prisma, { giftCardId: "gc1", userId: "u1", now: NOW });
    const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
    assert.equal(lots.length, 1);
    assert.equal(lots[0].source, "GIFT_CARD");
    assert.equal(lots[0].remainingCents, 2500);
    const user = await prisma.user.findUnique({ where: { id: "u1" } });
    assert.equal(await availableCredit(prisma, "u1", NOW), user.creditsCents);
    assert.equal(user.creditsCents, 2500);

    // Spendable at checkout: the quote takes credits (capped at $5) and PAID spends the lot.
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", useCreditsCents: 500, now: NOW });
    assert.equal(quote.discounts.creditsCents, 500);
    const order = await createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", userId: "u1", now: NOW, isDineInOrdersEnabled: () => true });
    const stripe = fakeStripe({ pi_rest: { status: "succeeded", amount: order.amountDueCents, metadata: { orderId: order.id } } });
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_rest", now: NOW }, fakeEffects().effects);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PAID");
    assert.equal(await availableCredit(prisma, "u1", NOW), 2000);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 2000);
  });

  test("an inactive or empty card is 400", async () => {
    const prisma = seed({ giftCards: [{ ...card, status: "EXHAUSTED", balanceCents: 0 }] });
    await assert.rejects(redeemGiftCard(prisma, { giftCardId: "gc1", userId: "u1", now: NOW }), (e) => e.status === 400);
    await assert.rejects(redeemGiftCard(prisma, { giftCardId: "nope", userId: "u1", now: NOW }), (e) => e.status === 404);
  });
});
