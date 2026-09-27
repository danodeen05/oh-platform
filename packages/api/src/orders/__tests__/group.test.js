/**
 * Task A7: "host pays for the group" as ONE server-created PaymentIntent for
 * the sum of the member orders' amountDueCents, confirmed through a
 * markPaidBatch-style group settle.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { seed, fakeStripe, fakeEffects, NOW, CLASSIC_BOWL } from "./fixtures.js";
import { quoteOrder, createOrder, markPaid, createGroupPaymentIntent, markGroupPaid } from "../service.js";

const GROUP = { id: "g1", code: "ABC234", hostUserId: "u1", locationId: "L1", tenantId: "t1", status: "CLOSED", expiresAt: new Date(NOW.getTime() + 30 * 60000) };

async function memberOrder(prisma, { userId = null, guestId = null, groupOrderId = "g1", items = CLASSIC_BOWL } = {}) {
  const quote = await quoteOrder(prisma, { locationId: "L1", items, userId, now: NOW });
  return createOrder(prisma, { quote, locationId: "L1", userId, guestId, now: NOW, isDineInOrdersEnabled: () => true, group: groupOrderId ? { groupOrderId, isGroupHost: userId === "u1" } : null });
}

async function setup({ stripeIntents = {}, onRetrieve = null, failCreate = false } = {}) {
  const prisma = seed({ groupOrders: [{ ...GROUP }, { ...GROUP, id: "g2", code: "XYZ789", hostUserId: "u2" }], guests: [{ id: "guest1", name: "Pat", sessionToken: "gs_1", expiresAt: new Date(NOW.getTime() + 3600000) }] });
  const host = await memberOrder(prisma, { userId: "u1" });
  const member = await memberOrder(prisma, { guestId: "guest1", items: [{ menuItemId: "wagyu", quantity: 1 }] });
  const stripe = fakeStripe(stripeIntents, { onRetrieve, failCreate });
  return { prisma, stripe, host, member };
}

const ids = (...orders) => orders.map((o) => o.id).sort().join(",");

describe("createGroupPaymentIntent", () => {
  test("one PaymentIntent for the sum of the unpaid member orders' amountDueCents, metadata kind=group + orderIds", async () => {
    const { prisma, stripe, host, member } = await setup();
    // Not part of this charge: another group's order, a cancelled member order, a paid member order.
    await memberOrder(prisma, { userId: "u2", groupOrderId: "g2" });
    const cancelled = await memberOrder(prisma, { userId: "u2" });
    await prisma.order.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });
    const res = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    assert.equal(host.amountDueCents, 1924);
    assert.equal(member.amountDueCents, 2639);
    assert.equal(res.amountCents, 1924 + 2639);
    assert.deepEqual([...res.orderIds].sort().join(","), ids(host, member));
    assert.equal(stripe.created.length, 1);
    const params = stripe.created[0];
    assert.equal(params.amount, 4563);
    assert.equal(params.currency, "usd");
    assert.equal(params.metadata.kind, "group");
    assert.equal(params.metadata.groupOrderId, "g1");
    assert.equal(params.metadata.orderIds.split(",").sort().join(","), ids(host, member));
    assert.ok(res.clientSecret);
    const group = await prisma.groupOrder.findUnique({ where: { id: "g1" } });
    assert.equal(group.status, "PAYING", "the group stops taking orders while the host pays");
    assert.equal(group.paymentMethod, "HOST_PAYS_ALL");
  });

  test("nothing unpaid is 409; a paid or cancelled group is 409; an unknown group is 404", async () => {
    const { prisma, stripe } = await setup();
    await assert.rejects(createGroupPaymentIntent(prisma, stripe, { groupOrderId: "nope", now: NOW }), (e) => e.status === 404);
    await prisma.groupOrder.update({ where: { id: "g1" }, data: { status: "CANCELLED" } });
    await assert.rejects(createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }), (e) => e.code === "GROUP_NOT_PAYABLE" && e.status === 409);
    const empty = seed({ groupOrders: [{ ...GROUP }] });
    await assert.rejects(createGroupPaymentIntent(empty, stripe, { groupOrderId: "g1", now: NOW }), (e) => e.code === "NOTHING_TO_PAY" && e.status === 409);
  });
});

describe("markGroupPaid", () => {
  test("a verified group PaymentIntent pays every listed order once; the group is PAID; a repeat is idempotent", async () => {
    const intents = {};
    const { prisma, stripe, host, member } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    const { calls, effects } = fakeEffects();
    const res = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, effects);
    assert.equal(res.alreadyPaid, false);
    for (const o of [host, member]) {
      const row = await prisma.order.findUnique({ where: { id: o.id } });
      assert.equal(row.paymentStatus, "PAID");
      assert.equal(row.status, "QUEUED");
      assert.equal(row.stripePaymentId, paymentIntentId);
    }
    assert.equal(calls.sendOrderConfirmation, 2);
    const group = await prisma.groupOrder.findUnique({ where: { id: "g1" } });
    assert.equal(group.status, "PAID");
    assert.ok(group.finalizedAt);

    const again = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, effects);
    assert.equal(again.alreadyPaid, true);
    assert.equal(calls.sendOrderConfirmation, 2, "effects run once");
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("webhook and return page at once: one settle, effects once, no refund", async () => {
    const intents = {};
    const { prisma, stripe } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    const { calls, effects } = fakeEffects();
    const results = await Promise.all([
      markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, effects),
      markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, effects),
    ]);
    assert.deepEqual(results.map((r) => r.alreadyPaid).sort(), [false, true]);
    assert.equal(calls.sendOrderConfirmation, 2);
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("a PaymentIntent that has not succeeded pays nothing (402), and nothing is refunded", async () => {
    const intents = {};
    const { prisma, stripe, host } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    await assert.rejects(markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects), (e) => e.status === 402);
    await assert.rejects(markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId: null, now: NOW }, fakeEffects().effects), (e) => e.code === "PAYMENT_REQUIRED");
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("a PaymentIntent for another group, a single order, or the kiosk is refused (402) and not refunded", async () => {
    const { prisma, stripe, host, member } = await setup({
      stripeIntents: {
        pi_other: { status: "succeeded", amount: 4563, metadata: { kind: "group", groupOrderId: "g2", orderIds: "" } },
        pi_single: { status: "succeeded", amount: 1924, metadata: { orderId: "x" } },
        pi_kiosk: { status: "succeeded", amount: 4563, metadata: { source: "kiosk", locationId: "L1", orderIds: "" } },
      },
    });
    stripe.intents.pi_other.metadata.orderIds = ids(host, member);
    stripe.intents.pi_kiosk.metadata.orderIds = ids(host, member);
    for (const pi of ["pi_other", "pi_single", "pi_kiosk"]) {
      await assert.rejects(markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId: pi, now: NOW }, fakeEffects().effects), (e) => e.status === 402, pi);
    }
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("our group PaymentIntent for the wrong amount is refused and refunded in full", async () => {
    const { prisma, stripe, host, member } = await setup({ stripeIntents: { pi_short: { status: "succeeded", amount: 100, metadata: { kind: "group", groupOrderId: "g1", orderIds: "" } } } });
    stripe.intents.pi_short.metadata.orderIds = ids(host, member);
    await assert.rejects(
      markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId: "pi_short", now: NOW }, fakeEffects().effects),
      (e) => e.status === 402 && e.extra.refunded === true,
    );
    assert.equal(stripe.refundCalls.length, 1);
    assert.deepEqual(stripe.refundCalls[0][0], { payment_intent: "pi_short" }, "full refund: no amount");
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
  });

  test("a member paid their own order after the host's PaymentIntent: 409 GROUP_CHANGED, full refund, nothing else paid", async () => {
    const intents = {};
    const { prisma, stripe, host, member } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    intents.pi_own = { status: "succeeded", amount: member.amountDueCents, metadata: { orderId: member.id } };
    await markPaid(prisma, stripe, { orderId: member.id, paymentIntentId: "pi_own", now: NOW }, fakeEffects().effects);

    const err = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.code, "GROUP_CHANGED");
    assert.equal(err.status, 409);
    assert.equal(err.extra.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.deepEqual(stripe.refundCalls[0][0], { payment_intent: paymentIntentId });
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
    assert.equal((await prisma.order.findUnique({ where: { id: member.id } })).stripePaymentId, "pi_own", "the member's own payment stands");
  });

  test("the same race inside the settle (member pays between verification and settle): rolled back and refunded", async () => {
    const intents = {};
    let raced = false;
    let seen = 0;
    const ctx = {};
    const { prisma, stripe, host, member } = await setup({
      stripeIntents: intents,
      // The first retrieve reads the metadata; the second is verifiedIntent.
      // The member's own payment lands right after that verification.
      onRetrieve: async (id) => {
        if (raced || id !== ctx.pi || ++seen < 2) return;
        raced = true;
        await prisma.order.updateMany({ where: { id: ctx.member }, data: { paymentStatus: "PAID", stripePaymentId: "pi_own" } });
      },
    });
    ctx.member = member.id;
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    ctx.pi = paymentIntentId;
    intents[paymentIntentId].status = "succeeded";
    const err = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.status, 409);
    assert.equal(err.extra.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING", "host order rolled back");
  });

  test("a listed order that left the group is refused and the charge refunded", async () => {
    const intents = {};
    const { prisma, stripe, member } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    await prisma.order.update({ where: { id: member.id }, data: { groupOrderId: "g2" } });
    const err = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.status, 409);
    assert.equal(err.extra.refunded, true);
    assert.equal(stripe.refundCalls.length, 1);
  });

  test("a group cancelled after the PaymentIntent was made: refused, charge refunded in full", async () => {
    const intents = {};
    const { prisma, stripe, host } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    await prisma.groupOrder.update({ where: { id: "g1" }, data: { status: "CANCELLED" } });
    const err = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects).catch((e) => e);
    assert.equal(err.code, "GROUP_NOT_PAYABLE");
    assert.equal(err.extra.refunded, true);
    assert.deepEqual(stripe.refundCalls[0][0], { payment_intent: paymentIntentId });
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
  });

  test("a refunded group PaymentIntent never pays (409 PAYMENT_REFUNDED)", async () => {
    const intents = {};
    const { prisma, stripe, host } = await setup({ stripeIntents: intents });
    const { paymentIntentId } = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[paymentIntentId].status = "succeeded";
    stripe.issuedRefunds.push({ id: "re_x", payment_intent: paymentIntentId });
    await assert.rejects(markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId, now: NOW }, fakeEffects().effects), (e) => e.code === "PAYMENT_REFUNDED");
    assert.equal((await prisma.order.findUnique({ where: { id: host.id } })).paymentStatus, "PENDING");
  });

  test("zero due across the group: confirm without a PaymentIntent", async () => {
    const prisma = seed({
      groupOrders: [{ ...GROUP }],
      giftCards: [{ id: "gc1", code: "GIFT-0001", amountCents: 5000, balanceCents: 5000, status: "ACTIVE" }],
    });
    const quote = await quoteOrder(prisma, { locationId: "L1", items: CLASSIC_BOWL, userId: "u1", giftCardCode: "GIFT-0001", now: NOW });
    const o = await createOrder(prisma, { quote, locationId: "L1", userId: "u1", now: NOW, isDineInOrdersEnabled: () => true, group: { groupOrderId: "g1", isGroupHost: true } });
    assert.equal(o.amountDueCents, 0);
    const stripe = fakeStripe();
    const pi = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    assert.equal(pi.clientSecret, null);
    assert.equal(stripe.created.length, 0);
    const res = await markGroupPaid(prisma, stripe, { groupOrderId: "g1", paymentIntentId: null, now: NOW }, fakeEffects().effects);
    assert.equal(res.alreadyPaid, false);
    assert.equal((await prisma.order.findUnique({ where: { id: o.id } })).paymentStatus, "PAID");
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 5000 - 1924);
  });
});

describe("fix round 1: one live group PaymentIntent, persisted", () => {
  const groupRow = (prisma) => prisma.groupOrder.findUnique({ where: { id: "g1" } });

  test("the PaymentIntent id is stored on the group with the PAYING flip", async () => {
    const { prisma, stripe } = await setup();
    const res = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    const g = await groupRow(prisma);
    assert.equal(g.paymentIntentId, res.paymentIntentId);
    assert.equal(g.status, "PAYING");
  });

  test("a revisit after a succeeded-but-unconfirmed PaymentIntent settles the original; no second PaymentIntent", async () => {
    const intents = {};
    const { prisma, stripe, host, member } = await setup({ stripeIntents: intents });
    const first = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[first.paymentIntentId].status = "succeeded"; // the host paid, then the page died
    const { calls, effects } = fakeEffects();
    const again = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }, effects);
    assert.equal(again.alreadyPaid, true);
    assert.equal(again.clientSecret, null);
    assert.equal(again.paymentIntentId, first.paymentIntentId);
    assert.equal(stripe.created.length, 1, "no second PaymentIntent");
    for (const o of [host, member]) {
      const row = await prisma.order.findUnique({ where: { id: o.id } });
      assert.equal(row.paymentStatus, "PAID");
      assert.equal(row.stripePaymentId, first.paymentIntentId);
    }
    assert.equal(calls.sendOrderConfirmation, 2);
    assert.equal((await groupRow(prisma)).status, "PAID");
    // A third visit: the group is paid; still nothing new.
    const third = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }, effects);
    assert.equal(third.alreadyPaid, true);
    assert.equal(stripe.created.length, 1);
    assert.equal(stripe.refundCalls.length, 0);
  });

  test("an open PaymentIntent is reused (same id and client secret)", async () => {
    const { prisma, stripe } = await setup();
    const a = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    const b = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    assert.equal(b.paymentIntentId, a.paymentIntentId);
    assert.equal(b.clientSecret, a.clientSecret);
    assert.equal(b.reused, true);
    assert.equal(stripe.created.length, 1);
    assert.equal(stripe.cancelled.length, 0);
  });

  test("a changed sum cancels the old PaymentIntent and creates one new one", async () => {
    const intents = {};
    const { prisma, stripe, member } = await setup({ stripeIntents: intents });
    const a = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    // The member pays their own share meanwhile: the host now owes less.
    intents.pi_own = { status: "succeeded", amount: member.amountDueCents, metadata: { orderId: member.id } };
    await markPaid(prisma, stripe, { orderId: member.id, paymentIntentId: "pi_own", now: NOW }, fakeEffects().effects);
    const b = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    assert.notEqual(b.paymentIntentId, a.paymentIntentId);
    assert.equal(b.amountCents, 1924);
    assert.deepEqual(stripe.cancelled, [a.paymentIntentId]);
    assert.equal(intents[a.paymentIntentId].status, "canceled");
    assert.equal(stripe.created.length, 2);
    assert.equal((await groupRow(prisma)).paymentIntentId, b.paymentIntentId);
  });

  test("the old PaymentIntent succeeded just as it was being replaced: it is settled (refunded if it no longer fits), not doubled", async () => {
    const intents = {};
    const { prisma, stripe, member } = await setup({ stripeIntents: intents });
    const a = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents.pi_own = { status: "succeeded", amount: member.amountDueCents, metadata: { orderId: member.id } };
    await markPaid(prisma, stripe, { orderId: member.id, paymentIntentId: "pi_own", now: NOW }, fakeEffects().effects);
    // The host's card goes through between our retrieve and our cancel.
    const realRetrieve = stripe.paymentIntents.retrieve;
    let n = 0;
    stripe.paymentIntents.retrieve = async (id) => {
      const r = await realRetrieve(id);
      if (id === a.paymentIntentId && ++n === 1) intents[id].status = "succeeded";
      return r;
    };
    const err = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }).catch((e) => e);
    assert.equal(err.code, "GROUP_CHANGED", "the member's order was already paid: the host's charge can't apply");
    assert.equal(err.extra.refunded, true);
    assert.deepEqual(stripe.refundCalls.map((c) => c[0]), [{ payment_intent: a.paymentIntentId }]);
    assert.equal(stripe.created.length, 1, "no second PaymentIntent");
  });

  test("a failure before creation leaves the group as it was (minimum, Stripe error)", async () => {
    const small = await setup({ failCreate: true });
    await assert.rejects(createGroupPaymentIntent(small.prisma, small.stripe, { groupOrderId: "g1", now: NOW }), /stripe create failed/);
    let g = await groupRow(small.prisma);
    assert.equal(g.status, "CLOSED");
    assert.equal(g.paymentIntentId ?? null, null);
    assert.equal(g.paymentMethod ?? null, null);

    const { prisma, stripe, host, member } = await setup();
    await prisma.order.update({ where: { id: host.id }, data: { amountDueCents: 20 } });
    await prisma.order.update({ where: { id: member.id }, data: { amountDueCents: 20 } });
    await assert.rejects(createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }), (e) => e.code === "AMOUNT_BELOW_MINIMUM");
    g = await groupRow(prisma);
    assert.equal(g.status, "CLOSED");
    assert.equal(g.paymentIntentId ?? null, null);
    assert.equal(stripe.created.length, 0);
  });

  test("two concurrent starts leave exactly one live PaymentIntent", async () => {
    const intents = {};
    const { prisma, stripe } = await setup({ stripeIntents: intents });
    const [a, b] = await Promise.all([
      createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }),
      createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }),
    ]);
    assert.equal(a.paymentIntentId, b.paymentIntentId, "both callers get the stored one");
    const live = Object.entries(intents).filter(([, pi]) => pi.status !== "canceled").map(([id]) => id);
    assert.deepEqual(live, [a.paymentIntentId]);
    assert.equal((await groupRow(prisma)).paymentIntentId, a.paymentIntentId);
  });

  test("a stored PaymentIntent that was refunded is dead: a new one is created", async () => {
    const intents = {};
    const { prisma, stripe } = await setup({ stripeIntents: intents });
    const a = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    intents[a.paymentIntentId].status = "succeeded";
    stripe.issuedRefunds.push({ id: "re_old", payment_intent: a.paymentIntentId });
    const b = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    assert.notEqual(b.paymentIntentId, a.paymentIntentId);
    assert.ok(b.clientSecret);
    assert.equal((await groupRow(prisma)).paymentIntentId, b.paymentIntentId);
  });
});

describe("fix round 2 minors", () => {
  const groupRow = (prisma) => prisma.groupOrder.findUnique({ where: { id: "g1" } });

  test("(c) a new sum under the $0.50 minimum cancels the old open PaymentIntent before refusing, and the group leaves PAYING", async () => {
    const intents = {};
    const { prisma, stripe, host, member } = await setup({ stripeIntents: intents });
    const a = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW });
    await prisma.order.update({ where: { id: host.id }, data: { amountDueCents: 20 } });
    await prisma.order.update({ where: { id: member.id }, data: { amountDueCents: 20 } });
    await assert.rejects(createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }), (e) => e.code === "AMOUNT_BELOW_MINIMUM");
    assert.deepEqual(stripe.cancelled, [a.paymentIntentId]);
    assert.equal(intents[a.paymentIntentId].status, "canceled");
    assert.equal(stripe.created.length, 1, "no new PaymentIntent");
    const g = await groupRow(prisma);
    assert.equal(g.status, "CLOSED");
    assert.equal(g.paymentIntentId ?? null, null);
  });

  test("(a) the race loser whose Stripe read of the winner fails gets the intended 409, not a crash", async () => {
    const intents = {};
    const { prisma, stripe } = await setup({ stripeIntents: intents });
    // Another start stores its PaymentIntent between our read of the group and our conditional write.
    const realCreate = stripe.paymentIntents.create;
    stripe.paymentIntents.create = async (params) => {
      const mine = await realCreate(params);
      await prisma.groupOrder.update({ where: { id: "g1" }, data: { paymentIntentId: "pi_winner", status: "PAYING" } });
      return mine;
    };
    const err = await createGroupPaymentIntent(prisma, stripe, { groupOrderId: "g1", now: NOW }).catch((e) => e);
    assert.equal(err.code, "GROUP_CHANGED", "pi_winner doesn't exist in Stripe: retrieve throws, still a 409");
    assert.equal(err.status, 409);
    assert.deepEqual(stripe.cancelled, ["pi_test_1"], "the loser cancelled its own PaymentIntent");
  });
});

describe("createOrder for a group", () => {
  test("writes groupOrderId and isGroupHost with the server quote", async () => {
    const { host, member } = await setup();
    assert.equal(host.groupOrderId, "g1");
    assert.equal(host.isGroupHost, true);
    assert.equal(member.isGroupHost, false);
    assert.equal(member.guestId, "guest1");
    assert.equal(member.totalCents, 2639);
  });
});
