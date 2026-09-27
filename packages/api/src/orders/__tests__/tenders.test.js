import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { createGiftCard, createMealGift, acceptMealGift, applyGiftCardToOrder, redeemGiftCard } from "../tenders.js";
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
        // Task A7: the legacy accept only takes the caller's own UNPAID order.
        { id: "o-r1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
        { id: "o-r2", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
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

describe("Task A7: legacy /meal-gifts/:id/accept", () => {
  function fixture({ order = {}, gift = {} } = {}) {
    return seed({
      locations: [
        { id: "L1", tenantId: "t1", name: "City Creek Mall", taxRate: 0.1, timezone: "America/Denver", isClosed: false },
        { id: "L2", tenantId: "t1", name: "University Place", taxRate: 0.1, timezone: "America/Denver", isClosed: false },
      ],
      mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 3000, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW, paidAt: NOW, stripePaymentIntentId: "pi_gift", ...gift }],
      orders: [{ id: "o1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PENDING", status: "PENDING_PAYMENT", ...order }],
    });
  }
  const accept = (prisma) => acceptMealGift(prisma, { mealGiftId: "mg1", recipientUserId: "u1", orderId: "o1", now: NOW });

  test("a paid order is 409 and nothing is claimed or granted", async () => {
    const prisma = fixture({ order: { paymentStatus: "PAID", status: "QUEUED" } });
    await assert.rejects(accept(prisma), (e) => e.status === 409 && e.code === "ORDER_NOT_PAYABLE");
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).status, "PENDING");
    assert.equal((await prisma.creditEvent.findMany()).length, 0);
  });

  test("a cancelled order is 409", async () => {
    await assert.rejects(accept(fixture({ order: { status: "CANCELLED" } })), (e) => e.status === 409);
  });

  test("an order at another location than the gift's is 409", async () => {
    const prisma = fixture({ order: { locationId: "L2" } });
    await assert.rejects(accept(prisma), (e) => e.status === 409 && e.code === "MEAL_GIFT_WRONG_LOCATION");
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).status, "PENDING");
  });

  test("a gift with no location may be used at any location", async () => {
    const prisma = fixture({ order: { locationId: "L2" }, gift: { locationId: null } });
    const res = await accept(prisma);
    assert.equal(res.gift.status, "ACCEPTED");
  });

  test("an order whose quote already carries a meal gift is 409 (checkout spends that one at PAID)", async () => {
    await assert.rejects(accept(fixture({ order: { mealGiftId: "mg-other", mealGiftAppliedCents: 1924 } })), (e) => e.status === 409);
  });

  test("the caller's own unpaid order at the gift's location is accepted once", async () => {
    const prisma = fixture();
    const res = await accept(prisma);
    assert.equal(res.gift.status, "ACCEPTED");
    assert.equal(res.gift.orderId, "o1");
    await assert.rejects(accept(prisma), (e) => e.status === 409);
  });
});

describe("Task A7: /gift-cards/:id/apply", () => {
  function fixture({ order = {}, card = {} } = {}) {
    return seed({
      giftCards: [{ id: "gc1", code: "GIFT-0001", amountCents: 5000, balanceCents: 5000, status: "ACTIVE", ...card }],
      orders: [{ id: "o1", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1924, amountDueCents: 1924, paymentStatus: "PENDING", status: "PENDING_PAYMENT", ...order }],
    });
  }
  const balance = async (prisma) => (await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents;

  test("no verified caller is 401; someone else's order is 403; the card is untouched", async () => {
    const prisma = fixture();
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: {} }), (e) => e.status === 401);
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u2" } }), (e) => e.status === 403);
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { kioskLocationId: "L2" } }), (e) => e.status === 403);
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: undefined, amountCents: 1000, caller: { userId: "u1" } }), (e) => e.status === 400);
    assert.equal(await balance(prisma), 5000);
  });

  test("a guest order (no owner) can't be used by any member to drain a card", async () => {
    const prisma = fixture({ order: { userId: null, guestId: "guest1" } });
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } }), (e) => e.status === 403);
    assert.equal(await balance(prisma), 5000);
  });

  test("a paid or cancelled order is 409", async () => {
    await assert.rejects(applyGiftCardToOrder(fixture({ order: { paymentStatus: "PAID" } }), { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } }), (e) => e.status === 409);
    await assert.rejects(applyGiftCardToOrder(fixture({ order: { status: "CANCELLED" } }), { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } }), (e) => e.status === 409);
  });

  test("the owner applies at most what the order owes; the kiosk at its own location may apply", async () => {
    const prisma = fixture();
    const res = await applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 999999, caller: { userId: "u1" } });
    assert.deepEqual(res, { applied: 1924, remainingBalance: 5000 - 1924 });
    assert.equal(await balance(prisma), 5000 - 1924);
    const kiosk = fixture({ order: { userId: null } });
    const k = await applyGiftCardToOrder(kiosk, { giftCardId: "gc1", orderId: "o1", amountCents: 500, caller: { kioskLocationId: "L1" } });
    assert.equal(k.applied, 500);
  });

  test("concurrent applies never take the balance below zero (conditional debit)", async () => {
    const prisma = fixture({ card: { balanceCents: 1500 } });
    const results = await Promise.allSettled([
      applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } }),
      applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
    assert.equal(await balance(prisma), 500);
  });

  test("an exhausted card is not available", async () => {
    const prisma = fixture({ card: { balanceCents: 1000 } });
    await applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 1000, caller: { userId: "u1" } });
    const row = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.equal(row.balanceCents, 0);
    assert.equal(row.status, "EXHAUSTED");
    await assert.rejects(applyGiftCardToOrder(prisma, { giftCardId: "gc1", orderId: "o1", amountCents: 100, caller: { userId: "u1" } }), (e) => e.status === 400);
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

  test("an inactive or empty card is 400", async () => {
    const prisma = seed({ giftCards: [{ ...card, status: "EXHAUSTED", balanceCents: 0 }] });
    await assert.rejects(redeemGiftCard(prisma, { giftCardId: "gc1", userId: "u1", now: NOW }), (e) => e.status === 400);
    await assert.rejects(redeemGiftCard(prisma, { giftCardId: "nope", userId: "u1", now: NOW }), (e) => e.status === 404);
  });
});
