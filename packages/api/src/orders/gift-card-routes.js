/**
 * Gift card routes (moved out of index.js in Task A7 fix round 2).
 *
 *   POST /gift-cards                        buy a card (verified funding, orders/tenders.js createGiftCard)
 *   GET  /gift-cards/:id                    staff (console-guard STAFF)
 *   GET  /gift-cards/code/:code             balance lookup for checkout
 *   POST /gift-cards/:id/confirm-payment    Stripe webhook: records the verified purchase PaymentIntent
 *
 * Deliberately absent (404):
 *   POST /gift-cards/:id/apply   removed in fix round 1: it drained a card
 *                                without lowering what the order owed.
 *   POST /gift-cards/:id/redeem  removed in fix round 2: it turned card value
 *                                into 90-day credit, but gift card value may not
 *                                expire within 5 years of issue (CARD Act).
 * A gift card is spent only as checkout tender from its own, non-expiring
 * balance: giftCardCode in quoteOrder, debited in markPaid (service.js).
 *
 * Registered after the console guard and the customer identity hooks, as in index.js.
 */
import { orderOwnerId } from "../auth/customer.js";
import { OrderError } from "./service.js";
import { createGiftCard } from "./tenders.js";

/** Secure gift card code (XXXX-XXXX-XXXX-XXXX), no I, O, 0 or 1. */
export function generateGiftCardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerGiftCardRoutes(app, { prisma, stripe, customerAuth, sendGiftCardEmail = async () => {} }) {
  // Purchase a gift card
  app.post("/gift-cards", async (req, reply) => {
    try {
      const { amountCents, designId, recipientEmail, recipientName, personalMessage, stripePaymentId } = req.body || {};

      // Task A6: a gift card is a tender, so it must be funded. A customer card
      // needs its purchase PaymentIntent verified here (succeeded, exactly
      // amountCents, metadata {type:"gift_card", amountCents}, unused). Trusted
      // server-to-server callers (x-admin-api-key) may issue without one.
      const trusted = customerAuth.isServiceCall(req);
      const who = await customerAuth.resolve(req);
      let giftCard;
      try {
        giftCard = await createGiftCard(prisma, stripe, {
          amountCents,
          designId,
          recipientEmail,
          recipientName,
          personalMessage,
          purchaserId: trusted ? req.body?.purchaserId || null : orderOwnerId(who),
          stripePaymentId: stripePaymentId || null,
          trusted,
          generateCode: generateGiftCardCode,
        });
      } catch (err) {
        if (err instanceof OrderError) return reply.status(err.status).send({ error: err.message, code: err.code, ...err.extra });
        throw err;
      }

      // Send email delivery if recipient email provided
      if (recipientEmail) {
        try {
          await sendGiftCardEmail(giftCard);
          await prisma.giftCard.update({ where: { id: giftCard.id }, data: { deliveredAt: new Date() } });
        } catch (emailErr) {
          console.error("Failed to send gift card email:", emailErr);
          // Don't fail the purchase if email fails
        }
      }

      return reply.send(giftCard);
    } catch (error) {
      console.error("Error creating gift card:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get gift card by ID
  app.get("/gift-cards/:id", async (req, reply) => {
    try {
      const giftCard = await prisma.giftCard.findUnique({
        where: { id: req.params.id },
        include: {
          purchaser: { select: { id: true, name: true } },
          redeemedBy: { select: { id: true, name: true } },
        },
      });
      if (!giftCard) return reply.status(404).send({ error: "Gift card not found" });
      return reply.send(giftCard);
    } catch (error) {
      console.error("Error fetching gift card:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Lookup gift card by code (checkout tender)
  app.get("/gift-cards/code/:code", async (req, reply) => {
    try {
      const { code } = req.params;
      // Normalize code (remove dashes, uppercase), then build it with dashes for lookup
      const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const formattedCode = normalizedCode.length === 16
        ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}-${normalizedCode.slice(8, 12)}-${normalizedCode.slice(12, 16)}`
        : code.toUpperCase();

      const giftCard = await prisma.giftCard.findFirst({
        where: {
          OR: [{ code: formattedCode }, { code: code.toUpperCase() }],
          status: "ACTIVE",
          balanceCents: { gt: 0 },
        },
      });
      if (!giftCard) return reply.status(404).send({ error: "Gift card not found or has no balance" });

      // Return limited info for security
      return reply.send({ id: giftCard.id, balanceCents: giftCard.balanceCents, designId: giftCard.designId });
    } catch (error) {
      console.error("Error looking up gift card:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Confirm gift card payment (called by webhook)
  app.post("/gift-cards/:id/confirm-payment", async (req, reply) => {
    try {
      const { id } = req.params;
      const { stripePaymentId } = req.body || {};

      const card = await prisma.giftCard.findUnique({ where: { id } });
      if (!card) return reply.status(404).send({ error: "Gift card not found" });
      // Task A6: record only a succeeded PaymentIntent for this card's amount that names this card.
      const pi = stripe && stripePaymentId ? await stripe.paymentIntents.retrieve(stripePaymentId).catch(() => null) : null;
      if (!pi || pi.status !== "succeeded" || pi.amount !== card.amountCents || pi.metadata?.giftCardId !== id) {
        return reply.status(402).send({ error: "PAYMENT_NOT_VERIFIED" });
      }

      await prisma.giftCard.update({ where: { id }, data: { stripePaymentId } });
      return reply.send({ success: true });
    } catch (error) {
      console.error("Error confirming gift card payment:", error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
