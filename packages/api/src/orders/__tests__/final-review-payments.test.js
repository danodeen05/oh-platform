/**
 * Final review I4 (two concurrent card payments for one order) and I5 (promo
 * limits enforced at PAID, not only at quote time; promos need a member).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, CLASSIC_BOWL } from "./fixtures.js";
import { quoteOrder, createOrder, markPaid } from "../service.js";

async function placeOrder(prisma, { userId = "u1", ...savings } = {}) {
  const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId, now: NOW, ...savings });
  const order = await createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", userId, now: NOW, isDineInOrdersEnabled: () => true });
  return { quote, order };
}

const promo = (over = {}) => ({
  id: "p1",
  code: "TENOFF",
  discountType: "PERCENTAGE",
  discountValue: 10,
  scope: "MENU",
  isActive: true,
  startsAt: new Date("2026-01-01"),
  perUserLimit: 1,
  totalUsageLimit: null,
  currentUsageCount: 0,
  locationIds: [],
  ...over,
});

describe("I4: two card payments for one order race", () => {
  test("concurrent confirms with two different PaymentIntents: one pays, the loser is refunded in FULL once, with a case", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const due = order.amountDueCents;
    const stripe = fakeStripe({
      pi_a: { status: "succeeded", amount: due, metadata: { orderId: order.id } },
      pi_b: { status: "succeeded", amount: due, metadata: { orderId: order.id } },
    });
    const [a, b] = await Promise.all([
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_a", now: NOW }, fakeEffects().effects),
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_b", now: NOW }, fakeEffects().effects),
    ]);
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(paid.paymentStatus, "PAID");
    const winner = paid.stripePaymentId;
    const loser = winner === "pi_a" ? "pi_b" : "pi_a";
    assert.equal([a, b].filter((r) => r.alreadyPaid).length, 1);
    assert.equal([a, b].find((r) => r.alreadyPaid).refunded, true);
    // Full refund: no amount key, only the losing PaymentIntent.
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: loser }]);
    const cases = await prisma.supportCase.findMany({ where: { orderId: order.id } });
    assert.equal(cases.length, 1);
    assert.match(cases[0].summary, /DUPLICATE_PAYMENT/);
    assert.match(cases[0].summary, /refunded in full/);

    // A webhook retry for the loser refunds nothing more and files no second case.
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: loser, now: NOW }, fakeEffects().effects);
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.supportCase.findMany({ where: { orderId: order.id } })).length, 1);
    // The winner is never refunded.
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: winner, now: NOW }, fakeEffects().effects);
    assert.equal(stripe.refundCalls.length, 1);
  });
});

describe("I5: promo limits at PAID", () => {
  test("a guest's quote never applies a promo (PROMO_REQUIRES_SIGN_IN)", async () => {
    const prisma = seed({ promoCodes: [promo()] });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: null, promoCode: "TENOFF", now: NOW });
    assert.equal(quote.discounts.promoCents, 0);
    assert.ok(quote.warnings.includes("PROMO_INVALID"));
    assert.ok(quote.warnings.includes("PROMO_REQUIRES_SIGN_IN"));
  });

  test("perUserLimit 1: two unpaid orders quoted with the promo; the second payment fails PROMO_EXHAUSTED, is refunded in full, order stays unpaid", async () => {
    const prisma = seed({ promoCodes: [promo()] });
    const first = (await placeOrder(prisma, { promoCode: "TENOFF" })).order;
    const second = (await placeOrder(prisma, { promoCode: "TENOFF" })).order;
    assert.ok(first.promoDiscountCents > 0 && second.promoDiscountCents > 0, "both quoted with the promo");
    const stripe = fakeStripe({
      pi_1: { status: "succeeded", amount: first.amountDueCents, metadata: { orderId: first.id } },
      pi_2: { status: "succeeded", amount: second.amountDueCents, metadata: { orderId: second.id } },
    });
    await markPaid(prisma, stripe, { orderId: first.id, paymentIntentId: "pi_1", now: NOW }, fakeEffects().effects);
    const err = await markPaid(prisma, stripe, { orderId: second.id, paymentIntentId: "pi_2", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.code, "PROMO_EXHAUSTED");
    assert.equal(err.status, 409);
    assert.equal(err.extra.refunded, true);
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: "pi_2" }]);
    assert.equal((await prisma.order.findUnique({ where: { id: second.id } })).paymentStatus !== "PAID", true);
    assert.equal((await prisma.promoCode.findUnique({ where: { id: "p1" } })).currentUsageCount, 1);
    assert.equal((await prisma.promoCodeUsage.findMany({ where: { promoCodeId: "p1" } })).length, 1);
  });

  test("totalUsageLimit: concurrent payments by different members never exceed the limit", async () => {
    const prisma = seed({ promoCodes: [promo({ totalUsageLimit: 1, perUserLimit: 5 })] });
    const a = (await placeOrder(prisma, { userId: "u1", promoCode: "TENOFF" })).order;
    const b = (await placeOrder(prisma, { userId: "u2", promoCode: "TENOFF" })).order;
    const stripe = fakeStripe({
      pi_a: { status: "succeeded", amount: a.amountDueCents, metadata: { orderId: a.id } },
      pi_b: { status: "succeeded", amount: b.amountDueCents, metadata: { orderId: b.id } },
    });
    const results = await Promise.allSettled([
      markPaid(prisma, stripe, { orderId: a.id, paymentIntentId: "pi_a", now: NOW }, fakeEffects().effects),
      markPaid(prisma, stripe, { orderId: b.id, paymentIntentId: "pi_b", now: NOW }, fakeEffects().effects),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected");
    assert.equal(rejected.reason.code, "PROMO_EXHAUSTED");
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.promoCode.findUnique({ where: { id: "p1" } })).currentUsageCount, 1);
  });

  test("a guest order that somehow carries a promo is refused at PAID and refunded", async () => {
    const prisma = seed({ promoCodes: [promo()] });
    const { order } = await placeOrder(prisma, { userId: null });
    await prisma.order.update({ where: { id: order.id }, data: { promoCodeId: "p1", promoDiscountCents: 100 } });
    const stripe = fakeStripe({ pi_g: { status: "succeeded", amount: order.amountDueCents, metadata: { orderId: order.id } } });
    const err = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_g", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.code, "PROMO_EXHAUSTED");
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.promoCode.findUnique({ where: { id: "p1" } })).currentUsageCount, 0);
  });

  test("within the limits the promo is recorded once at PAID", async () => {
    const prisma = seed({ promoCodes: [promo({ totalUsageLimit: 10 })] });
    const { order } = await placeOrder(prisma, { promoCode: "TENOFF" });
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: order.amountDueCents, metadata: { orderId: order.id } } });
    const res = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    assert.equal(res.alreadyPaid, false);
    assert.equal((await prisma.promoCode.findUnique({ where: { id: "p1" } })).currentUsageCount, 1);
    const usages = await prisma.promoCodeUsage.findMany({ where: { promoCodeId: "p1" } });
    assert.equal(usages.length, 1);
    assert.equal(usages[0].userId, "u1");
    assert.equal(stripe.refundCalls.length, 0);
  });
});
