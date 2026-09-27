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
 *   (e) order         -> paymentStatus REFUNDED (the order-level claim)
 *
 * Retry-safe: the Stripe call happens before any database write, and it is
 * idempotent, so a failure after it leaves the case OPEN and a retry finds
 * the existing refund and finishes the restores. The case claim (OPEN ->
 * RESOLVED) and the order claim (PAID -> REFUNDED) are conditional updates,
 * so a second resolve, or a second case on the same order, restores nothing.
 */
import { refundFullPayment } from "../orders/service.js";
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

/**
 * Refunds a support case's order in full and restores its tenders.
 * Returns { alreadyResolved, case, refundId, restores }.
 * Throws SupportError: 409 NO_ORDER, ORDER_NOT_PAID, ALREADY_REFUNDED,
 * SHARED_PAYMENT, NO_CARD_PAYMENT; 404 ORDER_NOT_FOUND; 503
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
  let refundId = null;
  if (order.stripePaymentId) {
    // A kiosk batch or a group host's single PaymentIntent pays several
    // orders. Refunding it whole would refund other people's orders, and a
    // share of it would be a partial refund: neither is allowed here.
    const payers = await prisma.order.count({ where: { stripePaymentId: order.stripePaymentId } });
    if (payers > 1) throw new SupportError("SHARED_PAYMENT", 409, "This payment covers other orders too. Refund it in Stripe by hand or give store credit.", { orders: payers });
    if (!stripe) throw new SupportError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
    try {
      ({ refundId } = await refundFullPayment(stripe, order.stripePaymentId));
    } catch (err) {
      log(`[support] refund FAILED for ${order.stripePaymentId} (order ${order.id}, case ${supportCase.id}):`, err?.message || err);
      throw new SupportError("REFUND_FAILED", 502, "Stripe could not refund this payment. Nothing was changed; try again.");
    }
  } else if (cardCents > 0) {
    throw new SupportError("NO_CARD_PAYMENT", 409, "No card payment is recorded for this order.");
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.supportCase.updateMany({
      where: { id: supportCase.id, status: "OPEN" },
      data: { status: "RESOLVED", resolution: "FULL_REFUND", resolvedBy, resolvedAt: now, amountCents: cardCents, resolutionNote: reason },
    });
    if (claim.count !== 1) return { alreadyResolved: true, case: await tx.supportCase.findUnique({ where: { id: supportCase.id } }) };

    const orderClaim = await tx.order.updateMany({ where: { id: order.id, paymentStatus: "PAID" }, data: { paymentStatus: "REFUNDED" } });
    // Lost to a concurrent refund of the same order through another case:
    // roll back so this case stays OPEN (the caller answers 409).
    if (orderClaim.count !== 1) throw new SupportError("ALREADY_REFUNDED", 409, "This order was already refunded.");

    const restores = await restoreTenders(tx, order, now);
    const detail = { refundId, paymentIntentId: order.stripePaymentId || null, refundedCents: cardCents, restores };
    const updated = await tx.supportCase.update({ where: { id: supportCase.id }, data: { resolutionDetail: detail } });
    return { alreadyResolved: false, case: updated, refundId, restores };
  });
}
