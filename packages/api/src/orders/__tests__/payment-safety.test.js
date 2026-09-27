/**
 * Task A6 fix round 1: settle pinned to the verified quote, refunds on an
 * unappliable charge, funded tenders only, the legacy-capable confirm.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, CLASSIC_BOWL } from "./fixtures.js";
import { quoteOrder, createOrder, markPaid, markPaidBatch, requoteOrder, confirmOrderPayment } from "../service.js";

async function placeOrder(prisma, { userId = "u1", items = CLASSIC_BOWL, now = NOW, ...savings } = {}) {
  const quote = await quoteOrder(prisma, { locationId: "L1", items, userId, now, ...savings });
  const order = await createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", userId, now, isDineInOrdersEnabled: () => true });
  return { quote, order };
}

const GIFT_CARD = { id: "gc1", code: "GIFT-0001", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" };

describe("Critical 2: settle is pinned to the verified quote", () => {
  test("a re-quote between verification and settle is 409 QUOTE_CHANGED; nothing is spent or paid; the charge is refunded once", async () => {
    const prisma = seed({ giftCards: [{ ...GIFT_CARD }] });
    const { order } = await placeOrder(prisma, { giftCardCode: "GIFT-0001" });
    assert.equal(order.amountDueCents, 924);
    let raced = false;
    const stripe = fakeStripe(
      { pi_ok: { status: "succeeded", amount: 924, metadata: { orderId: order.id } } },
      {
        // The owner removes the gift card right after Stripe verified the charge.
        onRetrieve: async () => {
          if (raced) return;
          raced = true;
          await requoteOrder(prisma, { orderId: order.id, userId: "u1", changes: { giftCardCode: null }, now: NOW });
        },
      },
    );
    const { calls, effects } = fakeEffects();
    await assert.rejects(
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects),
      (e) => e.code === "QUOTE_CHANGED" && e.status === 409 && e.extra.refunded === true,
    );
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 1000, "gift card not debited");
    assert.equal(calls.sendOrderConfirmation, 0);
    assert.equal(stripe.refundCalls.length, 1);
    assert.deepEqual(stripe.refundCalls[0][0], { payment_intent: "pi_ok" }, "full refund: no amount field");
    assert.equal((await prisma.supportCase.findMany({ where: { orderId: order.id } })).length, 1);

    // The webhook retries the same PaymentIntent: no second refund, no second case.
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects), (e) => e.status === 402 && e.extra.refunded === true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.supportCase.findMany({ where: { orderId: order.id } })).length, 1);
  });

  test("a PAID order can't be re-quoted", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    await assert.rejects(requoteOrder(prisma, { orderId: order.id, userId: "u1", changes: { promoCode: null }, now: NOW }), (e) => e.code === "ALREADY_PAID" && e.status === 409);
  });

  test("the re-quote write itself is conditional: paid in the meantime is 409", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const realFindMany = prisma.orderItem.findMany;
    prisma.orderItem.findMany = async (args) => {
      // A concurrent confirmation pays the order after requoteOrder read it.
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
      return realFindMany(args);
    };
    await assert.rejects(requoteOrder(prisma, { orderId: order.id, userId: "u1", changes: { promoCode: null }, now: NOW }), (e) => e.code === "ALREADY_PAID");
  });

  test("removing savings from a member's order needs that member", async () => {
    const prisma = seed({ giftCards: [{ ...GIFT_CARD }] });
    const { order } = await placeOrder(prisma, { giftCardCode: "GIFT-0001" });
    for (const userId of [null, "u2"]) {
      await assert.rejects(requoteOrder(prisma, { orderId: order.id, userId, changes: { giftCardCode: null }, now: NOW }), (e) => e.status === 403);
    }
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).giftCardAppliedCents, 1000);
  });

  test("kiosk batch claims are pinned to each order's verified amount due", async () => {
    const prisma = seed();
    const a = (await placeOrder(prisma, { userId: null })).order;
    const b = (await placeOrder(prisma, { userId: null })).order;
    let raced = false;
    const stripe = fakeStripe(
      { pi_t: { status: "succeeded", amount: 3848, metadata: { orderIds: `${a.id},${b.id}` } } },
      {
        onRetrieve: async () => {
          if (raced) return;
          raced = true;
          await prisma.order.update({ where: { id: b.id }, data: { amountDueCents: 1 } });
        },
      },
    );
    await assert.rejects(
      markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_t", locationId: "L1", now: NOW }, fakeEffects().effects),
      (e) => e.code === "QUOTE_CHANGED" && e.extra.refunded === true,
    );
    for (const id of [a.id, b.id]) assert.equal((await prisma.order.findUnique({ where: { id } })).paymentStatus, "PENDING");
    assert.equal(stripe.refundCalls.length, 1);
  });
});

describe("Important 2: a verified charge that can't be applied is refunded", () => {
  test("short ledger: one full refund (no amount key), one support case; a retry refunds nothing more", async () => {
    const prisma = seed({ creditLots: [{ id: "lot1", userId: "u1", source: "REFERRAL", amountCents: 300, remainingCents: 300, expiresAt: new Date(NOW.getTime() + HOUR_MS) }] });
    const { order } = await placeOrder(prisma, { useCreditsCents: 300 });
    const later = new Date(NOW.getTime() + 2 * HOUR_MS);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1624, metadata: { orderId: order.id } } });
    const first = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: later }, fakeEffects().effects).catch((e) => e);
    assert.equal(first.code, "CREDIT_SHORT");
    assert.equal(first.extra.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal("amount" in stripe.refundCalls[0][0], false);
    assert.deepEqual(stripe.refundCalls[0][1], { idempotencyKey: "order-refund-pi_ok" });
    const cases = await prisma.supportCase.findMany({ where: { orderId: order.id } });
    assert.equal(cases.length, 1);
    assert.equal(cases[0].type, "ORDER_ISSUE");
    assert.equal(cases[0].userId, "u1");
    assert.match(cases[0].summary, /CREDIT_SHORT/);
    assert.match(cases[0].summary, /re_test_1/);
    const second = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: later }, fakeEffects().effects).catch((e) => e);
    assert.equal(second.code, "PAYMENT_REFUNDED", "a refunded PaymentIntent is refused at verification");
    assert.equal(stripe.refundCalls.length, 1, "no second refund");
    assert.equal((await prisma.supportCase.findMany({ where: { orderId: order.id } })).length, 1);
  });

  test("a second, different charge for an already-paid order is refunded; the one that paid never is", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({
      pi_a: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } },
      pi_b: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } },
    });
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_a", now: NOW }, fakeEffects().effects);
    const dup = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_b", now: NOW }, fakeEffects().effects);
    assert.equal(dup.alreadyPaid, true);
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: "pi_b" }]);
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_a", now: NOW }, fakeEffects().effects);
    assert.equal(stripe.refundCalls.length, 1);
  });

  test("a PaymentIntent that never succeeded is not refunded", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_x: { status: "requires_payment_method", amount: 1924, metadata: { orderId: order.id } } });
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_x", now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    assert.equal(stripe.refundCalls.length, 0);
  });
});

describe("Critical 3: funded tenders only", () => {
  test("an unfunded meal gift (no paidAt) doesn't reduce the amount due or pay an order", async () => {
    const prisma = seed({ mealGifts: [{ id: "mg0", giverId: "u2", locationId: "L1", amountCents: 2500, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW, paidAt: null }] });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", mealGiftId: "mg0", now: NOW });
    assert.equal(quote.discounts.mealGiftCents, 0);
    assert.equal(quote.amountDueCents, 1924);
    assert.ok(quote.warnings.includes("MEAL_GIFT_UNAVAILABLE"));
    // Even an order that recorded it can't consume it at PAID.
    const { order } = await placeOrder(prisma);
    await prisma.order.update({ where: { id: order.id }, data: { mealGiftId: "mg0", mealGiftAppliedCents: 1924, amountDueCents: 0 } });
    await assert.rejects(markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects), (e) => e.code === "MEAL_GIFT_UNAVAILABLE");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("a funded meal gift pays", async () => {
    const prisma = seed({ mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 2500, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW, paidAt: NOW, stripePaymentIntentId: "pi_gift" }] });
    const { order } = await placeOrder(prisma, { mealGiftId: "mg1" });
    assert.equal(order.amountDueCents, 0);
    const res = await markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects);
    assert.equal(res.order.paymentStatus, "PAID");
  });

  test("gift card codes are matched with or without dashes", async () => {
    const prisma = seed({ giftCards: [{ id: "gc1", code: "ABCD-EFGH-JKLM-NPQR", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", giftCardCode: "abcdefghjklmnpqr", now: NOW });
    assert.equal(quote.discounts.giftCardCents, 1000);
  });
});

describe("Critical 1: legacy-capable confirm (/chappy/confirm-payment)", () => {
  test("a PaymentIntent for less than the amount due never marks PAID", async () => {
    const prisma = seed({ orders: [{ id: "legacy", totalCents: 1500, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: null }] });
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({
      pi_low: { status: "succeeded", amount: 100, metadata: { orderId: order.id } },
      pi_low_legacy: { status: "succeeded", amount: 100, metadata: { orderId: "legacy" } },
      pi_legacy: { status: "succeeded", amount: 1500, metadata: { orderId: "legacy" } },
    });
    await assert.rejects(confirmOrderPayment(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_low", now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    await assert.rejects(confirmOrderPayment(prisma, stripe, { orderId: "legacy", paymentIntentId: "pi_low_legacy", now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
    assert.equal((await prisma.order.findUnique({ where: { id: "legacy" } })).paymentStatus, "PENDING");
    const ok = await confirmOrderPayment(prisma, stripe, { orderId: "legacy", paymentIntentId: "pi_legacy", now: NOW }, fakeEffects().effects);
    assert.equal(ok.legacy, true);
    assert.equal(ok.order.paymentStatus, "PAID");
  });

  test("a server-priced order goes through markPaid (savings spent, idempotent)", async () => {
    const prisma = seed({ giftCards: [{ ...GIFT_CARD }] });
    const { order } = await placeOrder(prisma, { giftCardCode: "GIFT-0001" });
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 924, metadata: { orderId: order.id } } });
    const res = await confirmOrderPayment(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    assert.equal(res.legacy, false);
    assert.equal(res.order.paymentStatus, "PAID");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 0);
    const again = await confirmOrderPayment(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    assert.equal(again.alreadyPaid, true);
  });
});

describe("fix round 2: any failure after a verified charge refunds it", () => {
  test("a database error in the settle transaction: one full refund, one case, the original error re-thrown", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    const dbError = Object.assign(new Error("Transaction API error: connection reset"), { code: "P2028" });
    const realTx = prisma.$transaction;
    prisma.$transaction = async () => {
      throw dbError;
    };
    const err = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    prisma.$transaction = realTx;

    assert.equal(err, dbError, "the caller still gets the original error");
    assert.equal(err.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.deepEqual(stripe.refundCalls[0][0], { payment_intent: "pi_ok" }, "full refund: no amount field");
    const cases = await prisma.supportCase.findMany({ where: { orderId: order.id } });
    assert.equal(cases.length, 1);
    assert.match(cases[0].summary, /SETTLE_FAILED: P2028/);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");

    // A retry that fails the same way refunds nothing more.
    prisma.$transaction = async () => {
      throw dbError;
    };
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    prisma.$transaction = realTx;
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.supportCase.findMany({ where: { orderId: order.id } })).length, 1);
  });

  test("the same holds for the kiosk batch", async () => {
    const prisma = seed();
    const a = (await placeOrder(prisma, { userId: null })).order;
    const stripe = fakeStripe({ pi_t: { status: "succeeded", amount: 1924, metadata: { orderIds: a.id } } });
    const realTx = prisma.$transaction;
    prisma.$transaction = async () => {
      throw new TypeError("boom");
    };
    const err = await markPaidBatch(prisma, stripe, { orderIds: [a.id], paymentIntentId: "pi_t", locationId: "L1", now: NOW }, fakeEffects().effects).catch((e) => e);
    prisma.$transaction = realTx;
    assert.ok(err instanceof TypeError);
    assert.equal(err.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal("amount" in stripe.refundCalls[0][0], false);
  });
});

/** Replace prisma.$transaction for ONE call with `impl`, then restore the real one. */
function failTransactionOnce(prisma, impl) {
  const real = prisma.$transaction;
  prisma.$transaction = async (...args) => {
    prisma.$transaction = real;
    return impl(...args);
  };
}
const p2028 = () => Object.assign(new Error("Transaction API error: Unable to start a transaction in the given time."), { code: "P2028" });

describe("fix round 3: a refunded PaymentIntent never pays", () => {
  test("repro: P2028 -> refund -> retry is 409 PAYMENT_REFUNDED and the order stays unpaid", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    failTransactionOnce(prisma, async () => {
      throw p2028();
    });
    const first = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(first.code, "P2028");
    assert.equal(first.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);

    // Stripe still says "succeeded" for the refunded PaymentIntent.
    const retry = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(retry.code, "PAYMENT_REFUNDED");
    assert.equal(retry.status, 409);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal(row.status, "PENDING_PAYMENT");
    assert.equal(stripe.refundCalls.length, 1);
  });

  test("an expanded latest_charge with amount_refunded is refused too", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id }, latest_charge: { id: "ch_1", refunded: false, amount_refunded: 100 } } });
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects), (e) => e.code === "PAYMENT_REFUNDED");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("kiosk batch: P2028 -> refund -> retry is 409 PAYMENT_REFUNDED", async () => {
    const prisma = seed();
    const a = (await placeOrder(prisma, { userId: null })).order;
    const stripe = fakeStripe({ pi_t: { status: "succeeded", amount: 1924, metadata: { orderIds: a.id } } });
    failTransactionOnce(prisma, async () => {
      throw p2028();
    });
    const first = await markPaidBatch(prisma, stripe, { orderIds: [a.id], paymentIntentId: "pi_t", locationId: "L1", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(first.refunded, true);
    await assert.rejects(markPaidBatch(prisma, stripe, { orderIds: [a.id], paymentIntentId: "pi_t", locationId: "L1", now: NOW }, fakeEffects().effects), (e) => e.code === "PAYMENT_REFUNDED");
    assert.equal((await prisma.order.findUnique({ where: { id: a.id } })).paymentStatus, "PENDING");
  });

  test("legacy confirm (/chappy/confirm-payment) refuses a refunded PaymentIntent", async () => {
    const prisma = seed({ orders: [{ id: "legacy", totalCents: 1500, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: null }] });
    const stripe = fakeStripe({ pi_legacy: { status: "succeeded", amount: 1500, metadata: { orderId: "legacy" } } });
    stripe.issuedRefunds.push({ id: "re_old", payment_intent: "pi_legacy" });
    await assert.rejects(confirmOrderPayment(prisma, stripe, { orderId: "legacy", paymentIntentId: "pi_legacy", now: NOW }, fakeEffects().effects), (e) => e.code === "PAYMENT_REFUNDED");
    assert.equal((await prisma.order.findUnique({ where: { id: "legacy" } })).paymentStatus, "PENDING");
  });
});

describe("fix round 3: never refund a charge a concurrent settle applied", () => {
  test("the winner applied this PaymentIntent and the loser threw P2028: no refund, no case, the loser gets alreadyPaid", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    failTransactionOnce(prisma, async () => {
      // The webhook's settle committed while this request waited on the row lock.
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", status: "QUEUED", stripePaymentId: "pi_ok" } });
      throw p2028();
    });
    const res = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    assert.equal(res.alreadyPaid, true);
    assert.equal(res.order.paymentStatus, "PAID");
    assert.equal(stripe.refundCalls.length, 0);
    assert.equal((await prisma.supportCase.findMany()).length, 0);
  });

  test("kiosk batch: every order PAID with this PaymentIntent means no refund", async () => {
    const prisma = seed();
    const a = (await placeOrder(prisma, { userId: null })).order;
    const b = (await placeOrder(prisma, { userId: null })).order;
    const stripe = fakeStripe({ pi_t: { status: "succeeded", amount: 3848, metadata: { orderIds: `${a.id},${b.id}` } } });
    failTransactionOnce(prisma, async () => {
      for (const id of [a.id, b.id]) await prisma.order.update({ where: { id }, data: { paymentStatus: "PAID", stripePaymentId: "pi_t" } });
      throw p2028();
    });
    const res = await markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_t", locationId: "L1", now: NOW }, fakeEffects().effects);
    assert.equal(res.alreadyPaid, true);
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("paid by a DIFFERENT PaymentIntent is not 'applied elsewhere': this charge is refunded", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    failTransactionOnce(prisma, async () => {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", stripePaymentId: "pi_other" } });
      throw p2028();
    });
    const err = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.code, "P2028");
    assert.equal(err.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
  });

  test("when the re-read fails: no refund, one NEEDS_REVIEW case, the original error re-thrown", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    const realFind = prisma.order.findUnique;
    const dbError = p2028();
    failTransactionOnce(prisma, async () => {
      prisma.order.findUnique = async () => {
        throw new Error("Can't reach database server");
      };
      throw dbError;
    });
    const err = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects).catch((e) => e);
    prisma.order.findUnique = realFind;
    assert.equal(err, dbError);
    assert.equal(err.refunded, false);
    assert.equal(err.needsReview, true);
    assert.equal(stripe.refundCalls.length, 0);
    const cases = await prisma.supportCase.findMany();
    assert.equal(cases.length, 1);
    assert.match(cases[0].summary, /^NEEDS_REVIEW/);
    assert.equal(cases[0].type, "ORDER_ISSUE");
  });
});
