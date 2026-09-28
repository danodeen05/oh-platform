/**
 * Gift card routes (moved out of index.js in Task A7 fix round 2).
 *
 *   POST /gift-cards                        buy a card (verified funding, orders/tenders.js createGiftCard)
 *   GET  /gift-cards/:id                    staff (console-guard STAFF)
 *   GET  /gift-cards/code/:code             balance lookup for checkout
 *   POST /gift-cards/confirm-payment        Stripe webhook (ADMIN_API_KEY): finds the card by its purchase
 *                                           PaymentIntent, or issues it from the PaymentIntent's server-built
 *                                           metadata when the buyer's page never came back (Task D10a)
 *
 * Deliberately absent (404):
 *   POST /gift-cards/:id/apply   removed in fix round 1: it drained a card
 *                                without lowering what the order owed.
 *   POST /gift-cards/:id/redeem  removed in fix round 2: it turned card value
 *                                into 90-day credit, but gift card value may not
 *                                expire within 5 years of issue (CARD Act).
 *   POST /gift-cards/:id/confirm-payment  replaced in D10a: it matched metadata.giftCardId,
 *                                that no PaymentIntent ever carried (a card exists
 *                                only after its payment), so it never ran.
 * No promo codes and no store credit on a gift card purchase, ever (D10a
 * ruling): 400 NOT_ALLOWED_FOR_GIFT_CARDS.
 * A gift card is spent only as checkout tender from its own, non-expiring
 * balance: giftCardCode in quoteOrder, debited in markPaid (service.js).
 *
 * Registered after the console guard and the customer identity hooks, as in index.js.
 */
import { orderOwnerId } from "../auth/customer.js";
import { OrderError } from "./service.js";
import { createGiftCard } from "./tenders.js";
import { giftDiscountFields, notAllowedForGiftCards } from "./purchase-intents.js";

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
      const discounts = giftDiscountFields(req.body || {});
      if (discounts.length) {
        const err = notAllowedForGiftCards(discounts);
        return reply.status(err.status).send({ error: err.code, code: err.code, message: err.message, ...err.extra });
      }

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
        // The webhook may have issued this card first (POST /gift-cards/confirm-payment):
        // the buyer whose payment it was gets that same card back.
        if (err instanceof OrderError && err.code === "PAYMENT_ALREADY_USED" && !trusted) {
          const existing = await prisma.giftCard.findFirst({ where: { stripePaymentId } });
          const me = orderOwnerId(who) || null;
          // An anonymous purchase must also name the same recipient (fix round 1),
          // so a PaymentIntent id alone never returns a card's code.
          const sameRecipient = !existing?.recipientEmail || (typeof recipientEmail === "string" && recipientEmail.trim().toLowerCase() === existing.recipientEmail.trim().toLowerCase());
          if (existing && (existing.purchaserId || null) === me && (me || sameRecipient)) return reply.send(existing);
        }
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

  // Stripe webhook (server-to-server, ADMIN_API_KEY): make sure a succeeded
  // gift card PaymentIntent has its card. The card is found by its purchase
  // PaymentIntent; when the buyer's page never came back, it is issued here
  // from the PaymentIntent's metadata (built by POST /create-payment-intent),
  // after the same verification as a purchase. Idempotent.
  app.post("/gift-cards/confirm-payment", async (req, reply) => {
    try {
      if (!customerAuth.isServiceCall(req)) return reply.status(401).send({ error: "UNAUTHORIZED" });
      const paymentIntentId = req.body?.paymentIntentId;
      if (typeof paymentIntentId !== "string" || !paymentIntentId) return reply.status(400).send({ error: "PAYMENT_INTENT_REQUIRED" });

      const existing = await prisma.giftCard.findFirst({ where: { stripePaymentId: paymentIntentId } });
      if (existing) return reply.send({ success: true, giftCardId: existing.id, created: false });

      const pi = stripe ? await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null) : null;
      const md = pi?.metadata || {};
      if (!pi || md.type !== "gift_card") return reply.status(402).send({ error: "PAYMENT_NOT_VERIFIED" });

      let card;
      try {
        card = await createGiftCard(prisma, stripe, {
          amountCents: Number(md.amountCents),
          designId: md.designId || "classic",
          recipientEmail: md.recipientEmail || null,
          recipientName: md.recipientName || null,
          personalMessage: md.personalMessage || null,
          purchaserId: md.purchaserId || null,
          stripePaymentId: paymentIntentId,
          trusted: false, // always verified against Stripe, even for the webhook
          generateCode: generateGiftCardCode,
        });
      } catch (err) {
        if (err instanceof OrderError && err.code === "PAYMENT_ALREADY_USED") {
          const raced = await prisma.giftCard.findFirst({ where: { stripePaymentId: paymentIntentId } });
          if (raced) return reply.send({ success: true, giftCardId: raced.id, created: false });
        }
        if (err instanceof OrderError) return reply.status(err.status).send({ error: err.code, message: err.message, ...err.extra });
        throw err;
      }
      if (card.recipientEmail) {
        try {
          await sendGiftCardEmail(card);
          await prisma.giftCard.update({ where: { id: card.id }, data: { deliveredAt: new Date() } });
        } catch (emailErr) {
          console.error("Failed to send gift card email:", emailErr);
        }
      }
      return reply.send({ success: true, giftCardId: card.id, created: true });
    } catch (error) {
      console.error("Error confirming gift card payment:", error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
