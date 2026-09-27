/**
 * Funding of the tenders an order can be paid with (Task A6 fix round 1).
 *
 * A gift card or a meal gift reduces what a customer owes, so it must be
 * backed by money the server has verified:
 *  - a customer gift card is created (ACTIVE) only for a succeeded
 *    PaymentIntent for exactly its amount, typed and bound by metadata
 *    ({type:"gift_card", amountCents}), and used for one card only. Trusted
 *    server-to-server issuing (x-admin-api-key) needs no PaymentIntent.
 *  - a meal gift is created only for a succeeded PaymentIntent for exactly
 *    its amount from the verified giver ({type:"meal_gift", giverId,
 *    locationId}), and records paidAt; the order service refuses a gift
 *    without paidAt.
 * A PaymentIntent that took money for one of these but can't fund it (wrong
 * amount) is refunded in full with a support case.
 */
import { OrderError, verifiedIntent, refundUnappliedPayment } from "./service.js";
import { grantCredit, grantCreditInTx } from "../membership/credits.js";

export const MEAL_GIFT_GIVER_REWARD_CENTS = 500;
export const MEAL_GIFT_CHALLENGE_SLUG = "meal-for-stranger";

export const GIFT_CARD_MIN_CENTS = 1000;
export const GIFT_CARD_MAX_CENTS = 50000;
export const MEAL_GIFT_MIN_CENTS = 1599;
export const MEAL_GIFT_MAX_CENTS = 3500;

async function verifyFunding(prisma, stripe, { paymentIntentId, amount, matchesMetadata, userId }) {
  try {
    return await verifiedIntent(stripe, paymentIntentId, { amount, matchesMetadata });
  } catch (err) {
    if (err?.chargedIntent) {
      const r = await refundUnappliedPayment(prisma, stripe, { pi: err.chargedIntent, orderId: null, userId, code: "TENDER_NOT_FUNDED" });
      err.extra = { ...err.extra, refunded: r.refunded };
    }
    throw err;
  }
}

function isUniqueViolation(err) {
  return err && err.code === "P2002";
}

/**
 * Creates a gift card. Customers: `stripePaymentId` must be a verified,
 * unused purchase PaymentIntent for exactly `amountCents`. `trusted`
 * (server-to-server) cards are issued without one.
 */
export async function createGiftCard(prisma, stripe, {
  amountCents,
  designId = "classic",
  recipientEmail = null,
  recipientName = null,
  personalMessage = null,
  purchaserId = null,
  stripePaymentId = null,
  trusted = false,
  generateCode,
}) {
  if (!Number.isInteger(amountCents) || amountCents < GIFT_CARD_MIN_CENTS) throw new OrderError("AMOUNT_TOO_LOW", 400, "Minimum gift card amount is $10");
  if (amountCents > GIFT_CARD_MAX_CENTS) throw new OrderError("AMOUNT_TOO_HIGH", 400, "Maximum gift card amount is $500");

  if (!trusted) {
    if (!stripePaymentId) throw new OrderError("PAYMENT_REQUIRED", 402, "A gift card must be paid for.");
    const pi = await verifyFunding(prisma, stripe, {
      paymentIntentId: stripePaymentId,
      amount: amountCents,
      matchesMetadata: (md) => md.type === "gift_card" && String(md.amountCents) === String(amountCents),
      userId: purchaserId,
    });
    const used = await prisma.giftCard.findFirst({ where: { stripePaymentId: pi.id } });
    if (used) throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already bought a gift card.");
  }

  let code = null;
  for (let attempt = 0; attempt < 10 && !code; attempt++) {
    const candidate = generateCode();
    if (!(await prisma.giftCard.findUnique({ where: { code: candidate } }))) code = candidate;
  }
  if (!code) throw new OrderError("CODE_GENERATION_FAILED", 500, "Failed to generate unique code");

  try {
    return await prisma.giftCard.create({
      data: {
      code,
      amountCents,
      balanceCents: amountCents,
      designId: designId || "classic",
      purchaserId: purchaserId || null,
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
      personalMessage: personalMessage || null,
        stripePaymentId: trusted ? stripePaymentId || null : stripePaymentId,
        status: "ACTIVE",
      },
    });
  } catch (err) {
    // GiftCard.stripePaymentId is unique: a concurrent create with the same
    // PaymentIntent loses here even though both passed the findFirst check.
    if (isUniqueViolation(err) && stripePaymentId && (err.meta?.target || []).toString().includes("stripePaymentId")) {
      throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already bought a gift card.");
    }
    throw err;
  }
}

/**
 * Creates a funded meal gift. `giverId` is the verified caller. The giver's
 * PaymentIntent must be succeeded, for exactly `amountCents`, and bound to
 * this giver and location; each PaymentIntent funds one gift.
 */
export async function createMealGift(prisma, stripe, { giverId, locationId, amountCents, messageFromGiver = null, paymentIntentId, expiresAt, now = new Date() }) {
  if (!giverId) throw new OrderError("SIGN_IN_REQUIRED", 401, "Sign in required");
  if (!locationId) throw new OrderError("LOCATION_REQUIRED", 400, "locationId required");
  if (!Number.isInteger(amountCents) || amountCents < MEAL_GIFT_MIN_CENTS || amountCents > MEAL_GIFT_MAX_CENTS) {
    throw new OrderError("AMOUNT_OUT_OF_RANGE", 400, "Amount must be between $15.99 and $35.00");
  }
  if (!paymentIntentId) throw new OrderError("PAYMENT_REQUIRED", 402, "A meal gift must be paid for.");

  const pi = await verifyFunding(prisma, stripe, {
    paymentIntentId,
    amount: amountCents,
    matchesMetadata: (md) => md.type === "meal_gift" && md.giverId === giverId && md.locationId === locationId,
    userId: giverId,
  });
  const used = await prisma.mealGift.findFirst({ where: { stripePaymentIntentId: pi.id } });
  if (used) throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already funded a meal gift.");

  try {
    return await prisma.mealGift.create({
      data: {
        giverId,
        locationId,
        amountCents,
        messageFromGiver: messageFromGiver || null,
        expiresAt,
        status: "PENDING",
        stripePaymentIntentId: pi.id,
        paidAt: now,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already funded a meal gift.");
    throw err;
  }
}

/**
 * Everything that follows a meal gift being accepted onto an order: the chain
 * entry, the recipient's GIFT_EXCESS credit (the gift's value beyond what the
 * order used) and the giver's Meal for a Stranger reward. Callers must have
 * WON the gift's conditional PENDING -> ACCEPTED claim first (markPaid's
 * settle), so this runs once per gift. The giver reward is
 * additionally claimed once per giver through UserChallenge.rewardClaimed.
 */
export async function finishMealGiftAcceptance(prisma, { mealGift, recipientUserId, appliedCents, messageFromRecipient = null, now = new Date() }, { refreshWalletPass = () => {} } = {}) {
  const giftAmount = mealGift.amountCents;
  const excessAmount = Math.max(0, giftAmount - (appliedCents || 0));
  const refresh = (userId) => {
    try {
      Promise.resolve(refreshWalletPass(userId)).catch(() => {});
    } catch {
      // wallet refresh is best effort
    }
  };

  if (recipientUserId) {
    await prisma.mealGiftChain.create({
      data: { mealGiftId: mealGift.id, recipientId: recipientUserId, action: "ACCEPTED", messageFromRecipient: messageFromRecipient || null },
    });
  }

  if (excessAmount > 0 && recipientUserId) {
    await grantCredit(prisma, {
      userId: recipientUserId,
      source: "MEAL_GIFT",
      eventType: "GIFT_EXCESS",
      amountCents: excessAmount,
      note: `Meal gift excess credited (Gift: $${(giftAmount / 100).toFixed(2)}, Order: $${((appliedCents || 0) / 100).toFixed(2)})`,
      now,
    });
    refresh(recipientUserId);
  }

  // Giver reward, once per giver: claim UserChallenge.rewardClaimed
  // (false -> true) with a conditional update; only the winner grants.
  const challenge = await prisma.challenge.findUnique({ where: { slug: MEAL_GIFT_CHALLENGE_SLUG } });
  let rewardGiver = !challenge; // no challenge configured: once per gift (the gift claim guarantees it)
  if (challenge) {
    try {
      await prisma.userChallenge.create({
        data: { userId: mealGift.giverId, challengeId: challenge.id, progress: JSON.stringify({ accepted: true }), rewardClaimed: false },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // the row already exists: fine
    }
    const claim = await prisma.userChallenge.updateMany({
      where: { userId: mealGift.giverId, challengeId: challenge.id, rewardClaimed: false },
      data: { rewardClaimed: true, completedAt: now },
    });
    rewardGiver = claim.count === 1;
  }
  if (rewardGiver) {
    await grantCredit(prisma, {
      userId: mealGift.giverId,
      source: "CHALLENGE",
      amountCents: MEAL_GIFT_GIVER_REWARD_CENTS,
      note: "Meal for a Stranger challenge completed",
      now,
    });
    refresh(mealGift.giverId);
  }
  return { excessCents: recipientUserId ? excessAmount : 0, giverRewarded: rewardGiver };
}


// ---------------------------------------------------------------------------
// /gift-cards/:id/redeem (OWNER console route; Task A7)
// ---------------------------------------------------------------------------
// The legacy POST /gift-cards/:id/apply and POST /meal-gifts/:id/accept were
// deleted in A7 fix round 1: apply drained a card without lowering what the
// order owed, and accept turned pool value into credit. Checkout spends gift
// cards and meal gifts from the order's quote at PAID (service.js settleInTx).

/**
 * POST /gift-cards/:id/redeem: moves a card's whole balance to the verified
 * caller's account as a GIFT_CARD credit lot (grantCreditInTx). The claim (ACTIVE, balance as read -> REDEEMED, 0) is
 * conditional, so two concurrent redeems (or a redeem and an apply) credit
 * the balance once.
 */
export async function redeemGiftCard(prisma, { giftCardId, userId, now = new Date() }) {
  if (!userId) throw new OrderError("SIGN_IN_REQUIRED", 401, "Sign in required");
  const giftCard = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!giftCard) throw new OrderError("GIFT_CARD_NOT_FOUND", 404, "Gift card not found");
  if (giftCard.status !== "ACTIVE" || giftCard.balanceCents <= 0) throw new OrderError("GIFT_CARD_UNAVAILABLE", 400, "Gift card is not available for redemption");

  const CONFLICT = Symbol("conflict");
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.giftCard.updateMany({
        where: { id: giftCardId, status: "ACTIVE", balanceCents: giftCard.balanceCents },
        data: { status: "REDEEMED", redeemedById: userId, redeemedAt: now, balanceCents: 0 },
      });
      if (claimed.count !== 1) throw CONFLICT;
      // Through the ledger (fix round 1): a GIFT_CARD lot, the cached balance
      // and the event move together, so checkout can spend it.
      await grantCreditInTx(tx, {
        userId,
        source: "GIFT_CARD",
        amountCents: giftCard.balanceCents,
        note: `Gift card ${giftCard.code} redeemed to account balance (${giftCard.id})`,
        now,
      });
      return tx.giftCard.findUnique({ where: { id: giftCardId } });
    });
  } catch (err) {
    if (err === CONFLICT) throw new OrderError("GIFT_CARD_UNAVAILABLE", 409, "Gift card is not available for redemption");
    throw err;
  }
  return { success: true, creditsAdded: giftCard.balanceCents, giftCard: updated };
}
