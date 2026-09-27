import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, HOUR_MS, DAY_MS, CLASSIC_BOWL } from "./fixtures.js";
import {
  quoteOrder,
  createOrder,
  pickBestPod,
  createPaymentIntent,
  markPaid,
  markPaidBatch,
  requoteOrder,
  OrderError,
  PodUnavailableError,
} from "../service.js";

const DINE_IN_ON = () => true;

async function placeOrder(prisma, { userId = "u1", items = CLASSIC_BOWL, seatRequest = null, partySize = 1, now = NOW, ...savings } = {}) {
  const quote = await quoteOrder(prisma, { locationId: "L1", items, userId, now, ...savings });
  const order = await createOrder(prisma, {
    quote,
    locationId: "L1",
    tenantId: "t1",
    userId,
    estimatedArrival: new Date(now.getTime() + 30 * 60 * 1000),
    seatRequest,
    partySize,
    source: "WEB",
    now,
    isDineInOrdersEnabled: DINE_IN_ON,
  });
  return { quote, order };
}

describe("quoteOrder", () => {
  test("prices from the menu, taxes the location rate, and writes nothing", async () => {
    const prisma = seed();
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", now: NOW });
    assert.equal(quote.subtotalCents, 1749);
    assert.equal(quote.taxCents, 175);
    assert.equal(quote.totalCents, 1924);
    assert.equal(quote.amountDueCents, 1924);
    assert.deepEqual(quote.discounts, { promoCents: 0, creditsCents: 0, rewardCents: 0, giftCardCents: 0, mealGiftCents: 0 });
    assert.equal(quote.lines.find((l) => l.menuItemId === "bokchoy").priceCents, 150);
    assert.equal((await prisma.order.findMany()).length, 0);
  });

  test("an unavailable or cross-tenant item is a 400", async () => {
    const prisma = seed();
    for (const menuItemId of ["soldout", "foreign", "missing"]) {
      await assert.rejects(
        quoteOrder(prisma, { locationId: "L1", items: [{ menuItemId, quantity: 1 }], now: NOW }),
        (err) => err instanceof OrderError && err.status === 400 && err.code === "ITEM_UNAVAILABLE" && err.extra.menuItemId === menuItemId,
      );
    }
  });

  test("an item the caller's tier can't see yet is ITEM_NOT_RELEASED", async () => {
    const prisma = seed();
    await assert.rejects(
      quoteOrder(prisma, { locationId: "L1", items: [{ menuItemId: "preview", quantity: 1 }], userId: "u1", now: NOW }),
      (err) => err.code === "ITEM_NOT_RELEASED" && err.status === 400 && err.extra.menuItemId === "preview",
    );
  });

  test("credits: capped at $5, only for a signed-in member, never above the unexpired lots", async () => {
    const prisma = seed({ creditLots: [{ id: "lot1", userId: "u1", source: "WELCOME", amountCents: 900, remainingCents: 900, expiresAt: new Date(NOW.getTime() + 30 * DAY_MS) }] });
    const member = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", useCreditsCents: 900, now: NOW });
    assert.equal(member.discounts.creditsCents, 500);
    assert.equal(member.amountDueCents, 1424);
    const guest = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: null, useCreditsCents: 500, now: NOW });
    assert.equal(guest.discounts.creditsCents, 0);
    assert.ok(guest.warnings.includes("CREDITS_REQUIRE_SIGN_IN"));
  });

  test("a FREE_BOWL reward prices the bowl at $0 before tax; with no bowl it is REWARD_NOT_APPLICABLE", async () => {
    const prisma = seed({ rewards: [{ id: "r1", userId: "u1", type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(NOW.getTime() + DAY_MS) }] });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", rewardId: "r1", now: NOW });
    assert.equal(quote.discounts.rewardCents, 1599);
    assert.equal(quote.taxCents, 15); // 150 * 10%
    assert.equal(quote.amountDueCents, 165);
    await assert.rejects(
      quoteOrder(prisma, { locationId: "L1", items: [{ menuItemId: "egg", quantity: 1 }], userId: "u1", rewardId: "r1", now: NOW }),
      (err) => err.code === "REWARD_NOT_APPLICABLE" && err.status === 400,
    );
    await assert.rejects(
      quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u2", rewardId: "r1", now: NOW }),
      (err) => err.code === "REWARD_UNAVAILABLE" && err.status === 400,
    );
  });

  test("a promo lowers the taxable base; an invalid one is a warning, not a discount", async () => {
    const prisma = seed({
      promoCodes: [
        { id: "p1", code: "TENOFF", discountType: "PERCENTAGE", discountValue: 10, scope: "MENU", isActive: true, startsAt: new Date("2026-01-01"), perUserLimit: 1, currentUsageCount: 0, locationIds: [] },
        { id: "p2", code: "SHOPONLY", discountType: "FIXED_AMOUNT", discountValue: 500, scope: "SHOP", isActive: true, startsAt: new Date("2026-01-01"), perUserLimit: 1, currentUsageCount: 0, locationIds: [] },
      ],
    });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", promoCode: "tenoff", now: NOW });
    assert.equal(quote.discounts.promoCents, 175);
    assert.equal(quote.taxCents, 157); // (1749 - 175) * 10% = 157.4
    assert.equal(quote.applied.promoCodeId, "p1");
    const bad = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", promoCode: "SHOPONLY", now: NOW });
    assert.equal(bad.discounts.promoCents, 0);
    assert.ok(bad.warnings.includes("PROMO_INVALID"));
  });

  test("a meal gift and a gift card are tenders after tax", async () => {
    const prisma = seed({
      mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 500, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW }],
      giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }],
    });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", mealGiftId: "mg1", giftCardCode: "aaaa-bbbb-cccc-dddd", now: NOW });
    assert.equal(quote.taxCents, 175);
    assert.equal(quote.discounts.mealGiftCents, 500);
    assert.equal(quote.discounts.giftCardCents, 1000);
    assert.equal(quote.amountDueCents, 424);
  });
});

describe("createOrder", () => {
  test("persists the quote on the order and prices the line items", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(row.subtotalCents, 1749);
    assert.equal(row.taxCents, 175);
    assert.equal(row.totalCents, 1924);
    assert.equal(row.amountDueCents, 1924);
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal(row.status, "PENDING_PAYMENT");
    assert.equal(row.userId, "u1");
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    assert.equal(items.length, 3);
  });

  test("dine-in flag off refuses the order", async () => {
    const prisma = seed();
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, now: NOW });
    await assert.rejects(
      createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", now: NOW, isDineInOrdersEnabled: () => false }),
      (err) => err.code === "DINE_IN_DISABLED" && err.status === 403,
    );
  });

  test("an arrival after close is refused (America/Denver hours)", async () => {
    const prisma = seed();
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, now: NOW });
    await assert.rejects(
      createOrder(prisma, { quote, locationId: "L1", tenantId: "t1", estimatedArrival: new Date("2026-10-01T21:30:00-06:00"), now: NOW, isDineInOrdersEnabled: DINE_IN_ON }),
      (err) => err.code === "ARRIVAL_INVALID" && err.status === 400,
    );
  });

  test("Review Focus 1: two concurrent checkouts for B-07 - one gets it, the explicit other gets PodUnavailableError", async () => {
    const prisma = seed();
    const results = await Promise.allSettled([
      placeOrder(prisma, { userId: "u1", seatRequest: { label: "B-07" } }),
      placeOrder(prisma, { userId: "u2", seatRequest: { label: "B-07" } }),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    assert.equal(won.length, 1);
    assert.equal(lost.length, 1);
    assert.ok(lost[0].reason instanceof PodUnavailableError);
    assert.equal(won[0].value.order.seatId, "s-b07");
    const b07 = await prisma.seat.findUnique({ where: { id: "s-b07" } });
    assert.equal(b07.status, "RESERVED");
    const holders = (await prisma.order.findMany()).filter((o) => o.seatId === "s-b07");
    assert.equal(holders.length, 1, "never a double booking");
  });

  test("Review Focus 1: with best:true the loser gets the next best pod", async () => {
    const prisma = seed({ seats: [
      { id: "s-b07", locationId: "L1", number: "07", label: "B-07", finger: 1, position: 7, status: "AVAILABLE", podType: "SINGLE" },
      { id: "s-b08", locationId: "L1", number: "08", label: "B-08", finger: 1, position: 8, status: "AVAILABLE", podType: "SINGLE" },
    ] });
    const [a, b] = await Promise.all([
      placeOrder(prisma, { userId: "u1", seatRequest: { best: true } }),
      placeOrder(prisma, { userId: "u2", seatRequest: { best: true } }),
    ]);
    assert.deepEqual([a.order.seatId, b.order.seatId].sort(), ["s-b07", "s-b08"]);
  });

  test("the claim is a conditional updateMany on AVAILABLE, unretired seats", async () => {
    const prisma = seed();
    const calls = [];
    const tx = {
      seat: {
        findMany: prisma.seat.findMany,
        findFirst: prisma.seat.findFirst,
        findUnique: prisma.seat.findUnique,
        async updateMany(args) {
          calls.push(args);
          return { count: 0 }; // someone else got there first
        },
      },
    };
    await assert.rejects(pickBestPod(tx, { locationId: "L1", arrival: NOW, partySize: 1, requestedLabel: "B-07" }), PodUnavailableError);
    assert.deepEqual(calls[0], { where: { id: "s-b07", status: "AVAILABLE", retiredAt: null }, data: { status: "RESERVED" } });
  });

  test("best pod skips retired seats and gives a party of 2 a duo", async () => {
    const prisma = seed();
    const single = await pickBestPod(prisma, { locationId: "L1", arrival: NOW, partySize: 1 });
    assert.equal(single.seat.id, "s-a01");
    const duo = await pickBestPod(prisma, { locationId: "L1", arrival: NOW, partySize: 2 });
    assert.equal(duo.seat.id, "s-c01");
    assert.equal(duo.partner.id, "s-c02");
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-c02" } })).status, "RESERVED");
  });
});

describe("createPaymentIntent", () => {
  test("charges order.amountDueCents with metadata.orderId, never a client amount", async () => {
    const prisma = seed();
    const stripe = fakeStripe();
    const { order } = await placeOrder(prisma);
    const res = await createPaymentIntent(prisma, stripe, { orderId: order.id, userId: "u1", savePaymentMethod: false, now: NOW });
    assert.equal(res.clientSecret, "pi_test_1_secret_abc");
    assert.equal(res.amountDueCents, 1924);
    const params = stripe.created[0];
    assert.equal(params.amount, 1924);
    assert.equal(params.currency, "usd");
    assert.deepEqual(params.metadata, { orderId: order.id });
    assert.deepEqual(params.automatic_payment_methods, { enabled: true });
    assert.equal(params.setup_future_usage, undefined);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).stripePaymentIntentId, "pi_test_1");
  });

  test("a zero balance needs no PaymentIntent; a legacy order can't get one", async () => {
    const prisma = seed({ orders: [{ id: "legacy", totalCents: 1500, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: null }] });
    const stripe = fakeStripe();
    await assert.rejects(createPaymentIntent(prisma, stripe, { orderId: "legacy", now: NOW }), (e) => e.code === "LEGACY_ORDER" && e.status === 409);
    const free = seed({ orders: [{ id: "free", totalCents: 0, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: 0 }] });
    const res = await createPaymentIntent(free, stripe, { orderId: "free", now: NOW });
    assert.equal(res.clientSecret, null);
    assert.equal(stripe.created.length, 0);
  });
});

describe("markPaid", () => {
  test("a PaymentIntent that hasn't succeeded is refused with 402 and the order stays PENDING", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_1: { status: "requires_payment_method", amount: 1924, metadata: { orderId: order.id } } });
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_1", now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("amount mismatch and another order's PaymentIntent are refused", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({
      pi_cheap: { status: "succeeded", amount: 100, metadata: { orderId: order.id } },
      pi_other: { status: "succeeded", amount: 1924, metadata: { orderId: "someone-else" } },
    });
    for (const paymentIntentId of ["pi_cheap", "pi_other", "pi_missing"]) {
      await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId, now: NOW }, fakeEffects().effects), (e) => e.status === 402, paymentIntentId);
    }
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, now: NOW }, fakeEffects().effects), (e) => e.status === 402 && e.code === "PAYMENT_REQUIRED");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("Review Focus 2: webhook then return page - PAID once; streak, confirmation counted once; no cashback at PAID", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma, { seatRequest: { label: "B-07" } });
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id }, payment_method: "pm_1" } });
    const { calls, effects } = fakeEffects();

    const first = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects);
    const second = await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects);

    assert.equal(first.alreadyPaid, false);
    assert.equal(second.alreadyPaid, true);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PAID");
    assert.equal(row.status, "QUEUED");
    assert.equal(row.stripePaymentId, "pi_ok");
    assert.equal(row.paymentMethodLast4, "4242");
    assert.ok(row.podReservationExpiry > NOW);
    assert.equal(calls.sendOrderConfirmation, 1);
    assert.equal(calls.afterPaid, 1);
    const user = await prisma.user.findUnique({ where: { id: "u1" } });
    assert.equal(user.currentStreak, 3, "consecutive day: streak +1 once");
    assert.equal(user.lifetimeOrderCount, 5);
    assert.equal(user.lifetimeSpentCents, 1924);
    assert.equal((await prisma.creditLot.findMany({ where: { source: "CASHBACK" } })).length, 0, "cashback is paid at COMPLETED, not PAID");
    assert.equal((await prisma.creditEvent.findMany({ where: { type: "CASHBACK" } })).length, 0);
    assert.equal((await prisma.seat.findUnique({ where: { id: "s-b07" } })).status, "RESERVED");
  });

  test("Review Focus 2: concurrent webhook and return page still pay once", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1924, metadata: { orderId: order.id } } });
    const { calls, effects } = fakeEffects();
    const results = await Promise.all([
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects),
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, effects),
    ]);
    assert.deepEqual(results.map((r) => r.alreadyPaid).sort(), [false, true]);
    assert.equal(calls.sendOrderConfirmation, 1);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).lifetimeOrderCount, 5);
  });

  test("Review Focus 3: a credit lot that expires between quote and pay fails CREDIT_SHORT and the order stays unpaid", async () => {
    const prisma = seed({ creditLots: [{ id: "lot1", userId: "u1", source: "REFERRAL", amountCents: 300, remainingCents: 300, expiresAt: new Date(NOW.getTime() + HOUR_MS) }] });
    await prisma.user.update({ where: { id: "u1" }, data: { creditsCents: 300 } });
    const { quote, order } = await placeOrder(prisma, { useCreditsCents: 300 });
    assert.equal(quote.discounts.creditsCents, 300);
    assert.equal(order.amountDueCents, 1624);

    const later = new Date(NOW.getTime() + 2 * HOUR_MS);
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1624, metadata: { orderId: order.id } } });
    const { calls, effects } = fakeEffects();
    await assert.rejects(
      markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: later }, effects),
      (e) => e instanceof OrderError && e.code === "CREDIT_SHORT" && e.status === 409,
    );
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(row.paymentStatus, "PENDING");
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 300);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300, "never a negative or partial spend");
    assert.equal(calls.sendOrderConfirmation, 0);
  });

  test("credits are spent through the ledger at PAID, soonest-expiring first", async () => {
    const prisma = seed({ creditLots: [
      { id: "late", userId: "u1", source: "WELCOME", amountCents: 400, remainingCents: 400, expiresAt: new Date(NOW.getTime() + 60 * DAY_MS) },
      { id: "soon", userId: "u1", source: "REFERRAL", amountCents: 200, remainingCents: 200, expiresAt: new Date(NOW.getTime() + 5 * DAY_MS) },
    ] });
    await prisma.user.update({ where: { id: "u1" }, data: { creditsCents: 600 } });
    const { order } = await placeOrder(prisma, { useCreditsCents: 500 });
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 1424, metadata: { orderId: order.id } } });
    await markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "soon" } })).remainingCents, 0);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "late" } })).remainingCents, 100);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 100);
    const events = await prisma.creditEvent.findMany({ where: { type: "CREDIT_APPLIED" } });
    assert.equal(events.length, 1);
    assert.equal(events[0].amountCents, -500);
  });

  test("a server-verified zero balance is paid without a PaymentIntent; the reward is redeemed", async () => {
    const prisma = seed({
      rewards: [{ id: "r1", userId: "u1", type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(NOW.getTime() + DAY_MS) }],
      giftCards: [{ id: "gc1", code: "GIFT-0001", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }],
    });
    const { order } = await placeOrder(prisma, { rewardId: "r1", giftCardCode: "GIFT-0001" });
    assert.equal(order.amountDueCents, 0);
    const res = await markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, fakeEffects().effects);
    assert.equal(res.alreadyPaid, false);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PAID");
    const reward = await prisma.reward.findUnique({ where: { id: "r1" } });
    assert.equal(reward.redeemedOrderId, order.id);
    const card = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.equal(card.balanceCents, 1000 - 165);
  });

  test("a gift card drained between quote and pay is GIFT_CARD_SHORT", async () => {
    const prisma = seed({ giftCards: [{ id: "gc1", code: "GIFT-0001", amountCents: 1000, balanceCents: 1000, status: "ACTIVE" }] });
    const { order } = await placeOrder(prisma, { giftCardCode: "GIFT-0001" });
    await prisma.giftCard.update({ where: { id: "gc1" }, data: { balanceCents: 200 } });
    const stripe = fakeStripe({ pi_ok: { status: "succeeded", amount: 924, metadata: { orderId: order.id } } });
    await assert.rejects(markPaid(prisma, stripe, { orderId: order.id, paymentIntentId: "pi_ok", now: NOW }, fakeEffects().effects), (e) => e.code === "GIFT_CARD_SHORT" && e.status === 409);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "PENDING");
  });

  test("a meal gift is consumed once, at PAID", async () => {
    const prisma = seed({ mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 2500, status: "PENDING", expiresAt: new Date(NOW.getTime() + 6 * HOUR_MS), createdAt: NOW }] });
    const { order } = await placeOrder(prisma, { mealGiftId: "mg1" });
    assert.equal(order.amountDueCents, 0);
    const { calls, effects } = fakeEffects();
    await markPaid(prisma, fakeStripe(), { orderId: order.id, now: NOW }, effects);
    const gift = await prisma.mealGift.findUnique({ where: { id: "mg1" } });
    assert.equal(gift.status, "ACCEPTED");
    assert.equal(gift.orderId, order.id);
    assert.equal(calls.mealGiftAccepted, 1);
  });

  test("a legacy order (no amountDueCents) is LEGACY_ORDER", async () => {
    const prisma = seed({ orders: [{ id: "legacy", totalCents: 1500, paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountDueCents: null }] });
    await assert.rejects(markPaid(prisma, fakeStripe(), { orderId: "legacy", now: NOW }, fakeEffects().effects), (e) => e.code === "LEGACY_ORDER" && e.status === 409);
  });

  test("an order already COMPLETED when it is paid runs onOrderCompleted afterwards", async () => {
    const prisma = seed({ orders: [{ id: "o-done", userId: "u1", locationId: "L1", tenantId: "t1", totalCents: 1000, amountDueCents: 0, creditsAppliedCents: 0, paymentStatus: "PENDING", status: "COMPLETED" }] });
    const { calls, effects } = fakeEffects();
    await markPaid(prisma, fakeStripe(), { orderId: "o-done", now: NOW }, effects);
    assert.equal(calls.onOrderCompleted, 1);
    assert.equal((await prisma.order.findUnique({ where: { id: "o-done" } })).status, "COMPLETED");
  });
});

describe("requoteOrder", () => {
  test("sets credits on an unpaid order without spending them", async () => {
    const prisma = seed({ creditLots: [{ id: "lot1", userId: "u1", source: "WELCOME", amountCents: 900, remainingCents: 900, expiresAt: new Date(NOW.getTime() + 30 * DAY_MS) }] });
    const { order } = await placeOrder(prisma);
    const { order: updated } = await requoteOrder(prisma, { orderId: order.id, userId: "u1", changes: { useCreditsCents: 900 }, now: NOW });
    assert.equal(updated.creditsAppliedCents, 500);
    assert.equal(updated.amountDueCents, 1424);
    assert.equal((await prisma.creditLot.findUnique({ where: { id: "lot1" } })).remainingCents, 900);
  });

  test("only the order's owner may apply credits", async () => {
    const prisma = seed();
    const { order } = await placeOrder(prisma);
    await assert.rejects(requoteOrder(prisma, { orderId: order.id, userId: "u2", changes: { useCreditsCents: 100 }, now: NOW }), (e) => e.status === 403);
  });
});

describe("markPaidBatch (kiosk)", () => {
  test("one PaymentIntent for several orders: the amount must equal their sum", async () => {
    const prisma = seed();
    const a = (await placeOrder(prisma, { userId: null })).order;
    const b = (await placeOrder(prisma, { userId: null })).order;
    const stripe = fakeStripe({
      pi_short: { status: "succeeded", amount: 1924, metadata: { orderIds: `${a.id},${b.id}` } },
      pi_ok: { status: "succeeded", amount: 3848, metadata: { orderIds: `${a.id},${b.id}` } },
    });
    await assert.rejects(markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_short", locationId: "L1", now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    await assert.rejects(markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_ok", locationId: "L2", now: NOW }, fakeEffects().effects), (e) => e.status === 403);
    const res = await markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_ok", locationId: "L1", now: NOW }, fakeEffects().effects);
    assert.equal(res.orders.length, 2);
    for (const id of [a.id, b.id]) assert.equal((await prisma.order.findUnique({ where: { id } })).paymentStatus, "PAID");
    const again = await markPaidBatch(prisma, stripe, { orderIds: [a.id, b.id], paymentIntentId: "pi_ok", locationId: "L1", now: NOW }, fakeEffects().effects);
    assert.equal(again.alreadyPaid, true);
  });
});
