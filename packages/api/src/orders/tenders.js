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
    // Refund only a payment that is itself inconsistent: charged for a different amount than
    // the amount it was created for (metadata.amountCents). A request whose details differ
    // from the payment is the caller's error and is refused WITHOUT a refund: refunding it
    // would let a caller (a replay, or a race with the correct call or the webhook) refund a
    // payment that funds a card or a gift.
    const charged = err?.chargedIntent;
    const declared = charged?.metadata?.amountCents;
    if (charged && declared != null && String(charged.amount) !== String(declared)) {
      const r = await refundUnappliedPayment(prisma, stripe, { pi: charged, orderId: null, userId, code: "TENDER_NOT_FUNDED" });
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
    // Already-used check FIRST: verifyFunding refunds a charged PaymentIntent
    // whose details don't match, so a replay with changed details must never
    // reach it once the payment has bought a card (that would refund the card).
    if (await prisma.giftCard.findFirst({ where: { stripePaymentId } })) {
      throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already bought a gift card.");
    }
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
  // Already-used check FIRST (see createGiftCard): a replay of a payment that
  // already funded a gift, with changed details, must not reach the refund.
  if (await prisma.mealGift.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })) {
    throw new OrderError("PAYMENT_ALREADY_USED", 409, "That payment already funded a meal gift.");
  }

  const pi = await verifyFunding(prisma, stripe, {
    paymentIntentId,
    amount: amountCents,
    matchesMetadata: (md) =>
      md.type === "meal_gift" && md.giverId === giverId && md.locationId === locationId &&
      (md.amountCents == null || String(md.amountCents) === String(amountCents)),
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

  // Giver reward, the FIRST time only (Task D9 fix round 1, as the page
  // promises): claim UserChallenge.rewardClaimed (false -> true) with a
  // conditional update, so of any number of concurrent takes exactly one
  // wins. The Challenge row the claim hangs on is created (inactive) when it
  // is missing; before, a missing row paid the giver on every taken gift.
  // A giver already paid under that old rule (a prior reward lot) is marked
  // claimed and not paid again.
  const challenge = await mealGiftChallenge(prisma);
  try {
    await prisma.userChallenge.create({
      data: { userId: mealGift.giverId, challengeId: challenge.id, progress: JSON.stringify({ accepted: true }), rewardClaimed: false },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // the row already exists: fine
  }
  // Fix round 2: the claim and the CHALLENGE credit lot in one transaction
  // (grantCreditInTx), so the challenge is never marked complete unpaid.
  const rewardGiver = await prisma.$transaction(async (tx) => {
    const claim = await tx.userChallenge.updateMany({
      where: { userId: mealGift.giverId, challengeId: challenge.id, rewardClaimed: false },
      data: { rewardClaimed: true, completedAt: now },
    });
    if (claim.count !== 1) return false;
    const prior = await tx.creditLot.findFirst({ where: { userId: mealGift.giverId, source: "CHALLENGE", note: GIVER_REWARD_NOTE } });
    if (prior) return false;
    await grantCreditInTx(tx, {
      userId: mealGift.giverId,
      source: "CHALLENGE",
      amountCents: MEAL_GIFT_GIVER_REWARD_CENTS,
      note: GIVER_REWARD_NOTE,
      now,
    });
    return true;
  });
  if (rewardGiver) refresh(mealGift.giverId);
  return { excessCents: recipientUserId ? excessAmount : 0, giverRewarded: rewardGiver };
}

const GIVER_REWARD_NOTE = "Meal for a Stranger challenge completed";

/**
 * The Meal for a Stranger Challenge row the giver claim hangs on. Created
 * inactive when missing (so it is never listed; the site has its own page
 * for it). Two concurrent creates: the loser's unique violation re-reads.
 */
async function mealGiftChallenge(prisma) {
  const found = await prisma.challenge.findUnique({ where: { slug: MEAL_GIFT_CHALLENGE_SLUG } });
  if (found) return found;
  try {
    return await prisma.challenge.create({
      data: {
        slug: MEAL_GIFT_CHALLENGE_SLUG,
        name: "Meal for a Stranger",
        description: "Buy the next guest a bowl.",
        rewardCents: MEAL_GIFT_GIVER_REWARD_CENTS,
        iconEmoji: "",
        iconKey: MEAL_GIFT_CHALLENGE_SLUG,
        requirements: { type: "meal_gift" },
        isActive: false,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return prisma.challenge.findUnique({ where: { slug: MEAL_GIFT_CHALLENGE_SLUG } });
  }
}

// POST /gift-cards/:id/apply (A7 fix round 1), POST /meal-gifts/:id/accept
// (fix round 1) and POST /gift-cards/:id/redeem (fix round 2) were deleted.
// Checkout spends gift cards and meal gifts from the order's quote at PAID
// (service.js settleInTx). A gift card's value is never converted into
// expiring credit: card value may not expire within 5 years (CARD Act).
