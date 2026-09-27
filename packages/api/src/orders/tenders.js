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

  return prisma.giftCard.create({
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
