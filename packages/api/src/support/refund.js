/**
 * Staff full refund of one order (Task A9).
 *
 * Owner's rule: staff give store credit, or refund the ENTIRE order to the
 * card. Never a partial card refund. The card side goes through the single
 * refund path in orders/service.js (refundFullPayment: no amount field,
 * per-PaymentIntent idempotency key shared with A6's unapplied-payment
 * refunds). After Stripe confirms, one transaction claims the case and the
 * order and restores every store tender the order used:
 *   (a) credit spent  -> an ADMIN CreditLot "refund restore" + REFUND_RESTORE event
 *   (b) gift card     -> balance back (conditional update, never above face value)
 *   (c) reward        -> un-redeemed while its window is open, else re-issued for 30 days
 *   (d) meal gift     -> back to PENDING if it has not expired
 *   (e) order         -> paymentStatus REFUNDED (the order-level claim); an order still
 *                        in the kitchen is CANCELLED and its pod freed
 *   (f) cashback and goodwill earned on the order -> unspent remainder reversed
 *
 * See fullRefundCase for the claim / refund / finish sequence that keeps a
 * refunded card and a PAID order from ever co-existing without restores.
 */
import { refundFullPayment, PartialRefundError } from "../orders/service.js";
import { grantCreditInTx } from "../membership/credits.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REWARD_REISSUE_DAYS = 30;

export class SupportError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = "SupportError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

async function restoreTenders(tx, order, now) {
  const restores = { credit: null, giftCard: null, reward: null, mealGift: null };

  // (a) store credit the order spent
  if (order.creditsAppliedCents > 0 && order.userId) {
    await grantCreditInTx(tx, {
      userId: order.userId,
      source: "ADMIN",
      eventType: "REFUND_RESTORE",
      amountCents: order.creditsAppliedCents,
      orderId: order.id,
      note: "refund restore",
      now,
    });
    restores.credit = order.creditsAppliedCents;
  }

  // (b) gift card balance, never above the card's face value
  if (order.giftCardId && order.giftCardAppliedCents > 0) {
    const card = await tx.giftCard.findUnique({ where: { id: order.giftCardId } });
    const res = card
      ? await tx.giftCard.updateMany({
          where: { id: card.id, status: { in: ["ACTIVE", "EXHAUSTED"] }, balanceCents: { lte: card.amountCents - order.giftCardAppliedCents } },
          data: { balanceCents: { increment: order.giftCardAppliedCents }, status: "ACTIVE" },
        })
      : { count: 0 };
    restores.giftCard = res.count === 1 ? order.giftCardAppliedCents : `NOT_RESTORED:${card ? card.status : "MISSING"}`;
  }

  // (c) reward used on the order
  if (order.rewardId && order.userId) {
    const reward = await tx.reward.findUnique({ where: { id: order.rewardId } });
    if (reward && reward.redeemedOrderId === order.id) {
      if (reward.windowEndsAt > now) {
        const res = await tx.reward.updateMany({
          where: { id: reward.id, redeemedOrderId: order.id },
          data: { redeemedOrderId: null, redeemedAt: null },
        });
        restores.reward = res.count === 1 ? "UNREDEEMED" : "NOT_RESTORED";
      } else {
        // issuedFor is unique per (user, type): one re-issue per refunded order.
        await tx.reward.create({
          data: { userId: order.userId, type: reward.type, issuedFor: `refund:${order.id}`, windowEndsAt: new Date(now.getTime() + REWARD_REISSUE_DAYS * DAY_MS) },
        });
        restores.reward = "REISSUED";
      }
    } else {
      restores.reward = "NOT_RESTORED";
    }
  }

  // (d) meal gift, if unexpired. Only when the whole gift went to this order:
  // any excess was already paid out as the recipient's credit, so putting the
  // full gift back would hand that excess out twice.
  if (order.mealGiftId && order.mealGiftAppliedCents > 0) {
    const gift = await tx.mealGift.findUnique({ where: { id: order.mealGiftId } });
    if (!gift || gift.orderId !== order.id) restores.mealGift = "NOT_RESTORED";
    else if (!(gift.expiresAt > now)) restores.mealGift = "EXPIRED_NOT_RESTORED";
    else if (gift.amountCents > order.mealGiftAppliedCents) restores.mealGift = "EXCESS_PAID_NOT_RESTORED";
    else {
      const res = await tx.mealGift.updateMany({
        where: { id: gift.id, orderId: order.id, status: "ACCEPTED", expiresAt: { gt: now } },
        data: { status: "PENDING", acceptedById: null, orderId: null, acceptedAt: null },
      });
      restores.mealGift = res.count === 1 ? "PENDING" : "NOT_RESTORED";
    }
  }

  return restores;
}

/** Kitchen/pod states a refunded order is pulled out of. */
export const ACTIVE_ORDER_STATUSES = Object.freeze(["QUEUED", "PREPPING", "READY", "SERVING"]);
/** Orders that may hold a pod (an unpaid one keeps it RESERVED). */
const POD_HOLDING_STATUSES = ["PENDING_PAYMENT", "PAID", ...ACTIVE_ORDER_STATUSES];

/**
 * A refunded order still in the kitchen is cancelled and its pod (and dual
 * partner) freed, unless another live order has since taken that pod.
 *
 * `order` is a snapshot read before the Stripe call: it may be stale (e.g. the
 * order moved PAID -> QUEUED while Stripe was refunding it). The conditional
 * `updateMany` below is the real guard and always runs against the CURRENT
 * row, so a status that only became active during the Stripe call is still
 * cancelled; there is no early return on the stale `order.status`.
 */
async function cancelActiveOrder(tx, order) {
  const cancelled = await tx.order.updateMany({ where: { id: order.id, status: { in: [...ACTIVE_ORDER_STATUSES] } }, data: { status: "CANCELLED" } });
  if (cancelled.count !== 1) {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    const status = current ? current.status : order.status;
    // Genuinely not applicable (already COMPLETED/CANCELLED/etc): not a
    // warning. Still active but the updateMany still missed it (another
    // concurrent change) IS a warning: NOT_CANCELLED.
    return { order: ACTIVE_ORDER_STATUSES.includes(status) ? "NOT_CANCELLED" : status, seatsReleased: 0 };
  }
  let seatsReleased = 0;
  for (const seatId of [order.seatId, order.dualPartnerSeatId].filter(Boolean)) {
    const holder = await tx.order.findFirst({
      where: { id: { not: order.id }, status: { in: POD_HOLDING_STATUSES }, OR: [{ seatId }, { dualPartnerSeatId: seatId }] },
    });
    if (holder) continue;
    const res = await tx.seat.updateMany({ where: { id: seatId, status: { in: ["RESERVED", "OCCUPIED"] } }, data: { status: "AVAILABLE" } });
    seatsReleased += res.count;
  }
  return { order: "CANCELLED", seatsReleased };
}

/**
 * Credit the order EARNED is taken back once the order is refunded in full:
 * CASHBACK, and GOODWILL (the refund already makes the customer whole, so
 * keeping goodwill for the same order would be double compensation). The
 * unspent remainder of each such lot goes to 0 (conditional on the remainder
 * just read, so a concurrent spend is never double-counted); what was already
 * spent stays spent. The cached balance drops by exactly that amount, never
 * below 0, with an ADMIN_ADJUSTMENT event carrying `description`.
 * Reversed goodwill still counts toward the goodwill caps: those sum grants
 * (amountCents), not balances.
 */
async function reverseOrderLots(tx, order, source, description) {
  if (!order.userId) return 0;
  const lots = await tx.creditLot.findMany({ where: { userId: order.userId, source, orderId: order.id, remainingCents: { gt: 0 } } });
  let reversed = 0;
  for (const lot of lots) {
    const res = await tx.creditLot.updateMany({ where: { id: lot.id, remainingCents: lot.remainingCents }, data: { remainingCents: 0 } });
    if (res.count === 1) reversed += lot.remainingCents;
  }
  if (reversed === 0) return 0;
  const dec = await tx.user.updateMany({ where: { id: order.userId, creditsCents: { gte: reversed } }, data: { creditsCents: { decrement: reversed } } });
  if (dec.count !== 1) await tx.user.updateMany({ where: { id: order.userId }, data: { creditsCents: 0 } });
  await tx.creditEvent.create({
    data: { userId: order.userId, type: "ADMIN_ADJUSTMENT", amountCents: -reversed, orderId: order.id, description },
  });
  return reversed;
}

/** Restores that did not happen and staff should know about. */
function warningsFor(restores) {
  const warnings = [];
  if (typeof restores.giftCard === "string" && restores.giftCard.startsWith("NOT_RESTORED:")) {
    warnings.push(`GIFT_CARD_NOT_RESTORED:${restores.giftCard.slice("NOT_RESTORED:".length)}`);
  }
  if (restores.reward === "NOT_RESTORED") warnings.push("REWARD_NOT_RESTORED");
  if (restores.mealGift === "NOT_RESTORED") warnings.push("MEAL_GIFT_NOT_RESTORED");
  if (restores.order === "NOT_CANCELLED") warnings.push("ORDER_NOT_CANCELLED");
  return warnings;
}

/** How long a pending refund claim blocks other resolutions before a retry may take it over. */
export const REFUND_LEASE_MS = 5 * 60 * 1000;

/**
 * Refunds a support case's order in full and restores its tenders.
 *
 * Order of operations (so the card is never refunded while the order stays
 * PAID with nothing restored):
 *  1. read-only checks (order paid, PaymentIntent not shared, Stripe set up);
 *  2. claim the case as a PENDING refund: status stays OPEN, resolution
 *     FULL_REFUND, resolvedAt is the lease start, resolutionDetail
 *     {refundPending: true}. Credit, decline and goodwill all require
 *     resolution null, so nothing else can resolve the case meanwhile. A
 *     pending claim older than REFUND_LEASE_MS (a crash) may be taken over;
 *     a fresh one is 409 REFUND_IN_PROGRESS;
 *  3. the Stripe refund (refundFullPayment). On failure the claim is released
 *     and the case is left OPEN;
 *  4. after a refund, ALWAYS: the order claim (PAID -> REFUNDED, the real
 *     guard), cancel + free the pod, reverse cashback, restore tenders, and
 *     mark the case RESOLVED. If another case refunded the order first, this
 *     case is still RESOLVED with warning ORDER_ALREADY_REFUNDED (the Stripe
 *     call was idempotent, so no second refund).
 * Only a case that is no longer OPEN short-circuits (alreadyResolved).
 *
 * Returns { alreadyResolved, case, refundId, restores, warnings }.
 * Throws SupportError: 409 NO_ORDER, ORDER_NOT_PAID, ALREADY_REFUNDED,
 * SHARED_PAYMENT, NO_CARD_PAYMENT, REFUND_IN_PROGRESS,
 * PARTIALLY_REFUNDED_ELSEWHERE; 404 ORDER_NOT_FOUND; 503
 * PAYMENTS_UNAVAILABLE; 502 REFUND_FAILED.
 */
export async function fullRefundCase(prisma, stripe, { supportCase, resolvedBy, reason = null, now = new Date(), log = console.error }) {
  if (!supportCase.orderId) throw new SupportError("NO_ORDER", 409, "This case has no order to refund.");
  const order = await prisma.order.findUnique({ where: { id: supportCase.orderId } });
  if (!order) throw new SupportError("ORDER_NOT_FOUND", 404, "Order not found.");
  if (order.paymentStatus === "REFUNDED") throw new SupportError("ALREADY_REFUNDED", 409, "This order was already refunded.");
  if (order.paymentStatus !== "PAID") throw new SupportError("ORDER_NOT_PAID", 409, "This order is not paid.");

  // What went to the card (legacy pre-quote orders have no amountDueCents).
  const cardCents = order.amountDueCents ?? order.totalCents ?? 0;
  if (order.stripePaymentId) {
    // A kiosk batch or a group host's single PaymentIntent pays several
    // orders. Refunding it whole would refund other people's orders, and a
    // share of it would be a partial refund: neither is allowed.
    const payers = await prisma.order.count({ where: { stripePaymentId: order.stripePaymentId } });
    if (payers > 1) throw new SupportError("SHARED_PAYMENT", 409, "This payment covers other orders. Give store credit instead.", { orders: payers });
    if (!stripe) throw new SupportError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
  } else if (cardCents > 0) {
    throw new SupportError("NO_CARD_PAYMENT", 409, "No card payment is recorded for this order.");
  }

  // 2. Claim the case as a pending refund BEFORE any money moves.
  const id = supportCase.id;
  const claim = await prisma.supportCase.updateMany({
    where: {
      id,
      status: "OPEN",
      OR: [{ resolution: null }, { resolution: "FULL_REFUND", resolvedAt: { lt: new Date(now.getTime() - REFUND_LEASE_MS) } }],
    },
    data: { resolution: "FULL_REFUND", resolvedBy, resolvedAt: now, resolutionNote: reason, resolutionDetail: { refundPending: true, leaseAt: now.toISOString() } },
  });
  if (claim.count !== 1) {
    const current = await prisma.supportCase.findUnique({ where: { id } });
    if (!current || current.status !== "OPEN") return { alreadyResolved: true, case: current, refundId: null, restores: null, warnings: [] };
    throw new SupportError("REFUND_IN_PROGRESS", 409, "A refund for this case is already in progress.");
  }
  // Give the claim back (only ours: same lease start) so staff can act again.
  const release = async (code) => {
    try {
      await prisma.supportCase.updateMany({
        where: { id, status: "OPEN", resolution: "FULL_REFUND", resolvedAt: now },
        data: { resolution: null, resolvedBy: null, resolvedAt: null, resolutionNote: null, resolutionDetail: { lastRefundAttempt: { at: now.toISOString(), by: resolvedBy, error: code } } },
      });
    } catch (err) {
      log(`[support] could not release the refund claim on case ${id}:`, err?.message || err);
    }
  };

  // 3. The card.
  let refundId = null;
  let refundedCents = cardCents;
  if (order.stripePaymentId) {
    try {
      const r = await refundFullPayment(stripe, order.stripePaymentId);
      refundId = r.refundId;
      if (Number.isInteger(r.refundedCents)) refundedCents = r.refundedCents;
    } catch (err) {
      if (err instanceof PartialRefundError) {
        await release(err.code);
        throw new SupportError("PARTIALLY_REFUNDED_ELSEWHERE", 409, "Part of this payment was already refunded outside the app. Give store credit instead.", {
          refundedCents: err.refundedCents,
          amountCents: err.amountCents,
        });
      }
      log(`[support] refund FAILED for ${order.stripePaymentId} (order ${order.id}, case ${id}):`, err?.message || err);
      await release("REFUND_FAILED");
      throw new SupportError("REFUND_FAILED", 502, "Stripe could not refund this payment. Nothing was changed; try again.");
    }
  }

  // 4. The card is refunded: finish, whatever else happened meanwhile.
  return prisma.$transaction(async (tx) => {
    let restores = { order: null, seatsReleased: 0, cashbackReversed: 0, goodwillReversed: 0, credit: null, giftCard: null, reward: null, mealGift: null };
    let warnings = [];
    let resolution = "FULL_REFUND";
    let amountCents = refundedCents;
    let resolutionNote = reason;
    const orderClaim = await tx.order.updateMany({ where: { id: order.id, paymentStatus: "PAID" }, data: { paymentStatus: "REFUNDED" } });
    if (orderClaim.count === 1) {
      const cancel = await cancelActiveOrder(tx, order);
      const cashbackReversed = await reverseOrderLots(tx, order, "CASHBACK", "cashback reversed on refund");
      const goodwillReversed = await reverseOrderLots(tx, order, "GOODWILL", "goodwill reversed on refund");
      restores = { ...cancel, cashbackReversed, goodwillReversed, ...(await restoreTenders(tx, order, now)) };
      warnings = warningsFor(restores);
    } else {
      // Another case's actor won the race: the Stripe call above was
      // idempotent (same PaymentIntent, same refund), so no card was ever
      // charged or refunded twice, but this case never claims that money or
      // re-runs the restores. It is informational only.
      warnings = ["ORDER_ALREADY_REFUNDED"];
      const other = await tx.supportCase.findFirst({ where: { orderId: order.id, resolution: "FULL_REFUND", id: { not: id } } });
      resolution = "INFO";
      amountCents = null;
      resolutionNote = `order already refunded by case ${other ? other.id : "unknown"}`;
    }
    const detail = { refundId, paymentIntentId: order.stripePaymentId || null, refundedCents, restores, warnings };
    // Conditional on this actor's own claim (resolvedAt still equals the
    // lease timestamp it claimed with): a slower actor whose lease was taken
    // over by a retry while this Stripe call was in flight must not clobber
    // the newer claim's identity or resolutionDetail.
    const finalize = await tx.supportCase.updateMany({
      where: { id, status: "OPEN", resolution: "FULL_REFUND", resolvedAt: now },
      data: {
        status: "RESOLVED",
        resolution,
        resolvedBy,
        resolvedAt: now,
        resolutionNote,
        resolutionDetail: detail,
        ...(amountCents === null ? {} : { amountCents }),
      },
    });
    const updated = await tx.supportCase.findUnique({ where: { id } });
    if (finalize.count !== 1) {
      // Someone else's retry already took over (or finished) this case's
      // claim while our Stripe call was in flight: leave their record alone.
      return { alreadyResolved: true, case: updated, refundId, restores: null, warnings: [] };
    }
    return { alreadyResolved: false, case: updated, refundId, restores, warnings };
  });
}
