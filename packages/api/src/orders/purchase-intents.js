/**
 * POST /create-payment-intent: Stripe PaymentIntents for NON-food purchases
 * (moved out of index.js in Task D10a). Food orders are charged only through
 * POST /orders/:id/payment-intent (orders/service.js).
 *
 *  - shop_order / shop_order_instore: the amount is the shop order's amount
 *    due, computed by the server (shop/service.js). A client amountCents is
 *    refused with 400 (ruling R9). Needs { shopOrderId } and the order's
 *    owner (verified member or guest session).
 *  - gift_card: the face value is the buyer's choice, validated as a whole
 *    number of cents from $10 to $500; the metadata is built here, never
 *    copied from the client.
 *  - meal_gift: a signed-in giver, the amount within the meal-gift range, and
 *    metadata bound to the verified giver and the location.
 *
 * Ruling (D10a): no promo codes and no store credit on gift cards or meal
 * gifts, ever. Buying a gift card with store credit would turn non-cash
 * credit into a transferable cash equivalent. Any such field answers 400
 * NOT_ALLOWED_FOR_GIFT_CARDS.
 */
import { orderOwnerId } from "../auth/customer.js";
import { OrderError } from "./service.js";
import { GIFT_CARD_MIN_CENTS, GIFT_CARD_MAX_CENTS, MEAL_GIFT_MIN_CENTS, MEAL_GIFT_MAX_CENTS } from "./tenders.js";
import { createShopPaymentIntent } from "../shop/service.js";

export const PAYMENT_INTENT_KINDS = Object.freeze(["shop_order", "shop_order_instore", "gift_card", "meal_gift"]);
const SHOP_KINDS = new Set(["shop_order", "shop_order_instore"]);

/** Discount and credit fields that never apply to a gift card or meal gift purchase. */
export const GIFT_DISCOUNT_FIELDS = Object.freeze([
  "promoCode", "promoCodeId", "promoDiscountCents", "discountCents",
  "useCreditsCents", "creditsToApply", "creditsApplied", "applyCredits", "creditsCents",
]);

function present(v) {
  return !(v === undefined || v === null || v === "" || v === 0 || v === "0" || v === false || v === "false");
}

/** The discount/credit fields a gift purchase body (or its metadata) tries to use. */
export function giftDiscountFields(body = {}) {
  const md = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  return GIFT_DISCOUNT_FIELDS.filter((f) => present(body[f]) || present(md[f]));
}

export function notAllowedForGiftCards(fields) {
  return new OrderError("NOT_ALLOWED_FOR_GIFT_CARDS", 400, "Promo codes and store credit can't be used on gift cards or meal gifts.", { fields });
}

/** A whole number of cents from $10 to $500, or an OrderError (400). */
export function validGiftCardAmount(value) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(n)) throw new OrderError("INVALID_AMOUNT", 400, "Gift card amount must be a whole number of cents.");
  if (n < GIFT_CARD_MIN_CENTS) throw new OrderError("AMOUNT_TOO_LOW", 400, "Minimum gift card amount is $10");
  if (n > GIFT_CARD_MAX_CENTS) throw new OrderError("AMOUNT_TOO_HIGH", 400, "Maximum gift card amount is $500");
  return n;
}

const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The note a giver may leave (the page allows 200; Stripe metadata values allow 500). */
export const MEAL_GIFT_MESSAGE_MAX = 200;

/** Server-built meal gift metadata (Task D9 fix round 1): giver, location and the note. */
export function mealGiftMetadata({ giverId, locationId, messageFromGiver, amountCents }) {
  const md = { type: "meal_gift", giverId, locationId };
  // The amount the payment is for: a funding request for any other amount is not "ours".
  if (Number.isInteger(amountCents)) md.amountCents = String(amountCents);
  const note = text(messageFromGiver, MEAL_GIFT_MESSAGE_MAX);
  if (note) md.messageFromGiver = note;
  return md;
}

/** Server-built gift card metadata (Stripe: values up to 500 characters). */
export function giftCardMetadata({ amountCents, purchaserId, designId, recipientName, recipientEmail, personalMessage }) {
  const md = { type: "gift_card", amountCents: String(amountCents) };
  if (purchaserId) md.purchaserId = purchaserId;
  const fields = { designId: text(designId, 40), recipientName: text(recipientName, 120), recipientEmail: text(recipientEmail, 254), personalMessage: text(personalMessage, 500) };
  for (const [k, v] of Object.entries(fields)) if (v) md[k] = v;
  return md;
}

export function registerPurchaseIntentRoute(app, { prisma, stripe, customerAuth, shopOrderAccess }) {
  app.post("/create-payment-intent", async (req, reply) => {
    try {
      const body = req.body || {};
      const md = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const kind = body.kind || md.type;

      // A food order (or anything naming one) can't set its own amount.
      if (md.orderId || md.orderIds || body.orderId || !PAYMENT_INTENT_KINDS.includes(kind)) {
        return reply.status(400).send({ error: "USE_ORDER_PAYMENT_INTENT", message: "Food orders are paid through POST /orders/:id/payment-intent." });
      }
      if (!stripe) return reply.status(500).send({ error: "Stripe is not configured" });

      try {
        if (SHOP_KINDS.has(kind)) {
          if (body.amountCents !== undefined || md.amountCents !== undefined) {
            return reply.status(400).send({ error: "AMOUNT_NOT_ALLOWED", message: "The server prices shop orders; send shopOrderId only." });
          }
          const shopOrderId = body.shopOrderId || md.shopOrderId;
          if (typeof shopOrderId !== "string" || !shopOrderId) return reply.status(400).send({ error: "SHOP_ORDER_REQUIRED" });
          const order = await prisma.shopOrder.findUnique({ where: { id: shopOrderId } });
          if (!order) return reply.status(404).send({ error: "NOT_FOUND" });
          const access = await shopOrderAccess(req, order);
          if (typeof access === "object") return reply.status(access.status).send({ error: access.status === 401 ? "SIGN_IN_REQUIRED" : "FORBIDDEN" });
          const who = await customerAuth.resolve(req);
          const r = await createShopPaymentIntent(prisma, stripe, { orderId: order.id, customerUserId: orderOwnerId(who) });
          return reply.send({ clientSecret: r.clientSecret, id: r.paymentIntentId, paymentIntentId: r.paymentIntentId, amountCents: r.amountDueCents });
        }

        const discounts = giftDiscountFields(body);
        if (discounts.length) throw notAllowedForGiftCards(discounts);

        if (kind === "gift_card") {
          const amountCents = validGiftCardAmount(body.amountCents ?? md.amountCents);
          const who = await customerAuth.resolve(req);
          const pick = (k) => body[k] ?? md[k];
          const metadata = giftCardMetadata({
            amountCents,
            purchaserId: orderOwnerId(who),
            designId: pick("designId"),
            recipientName: pick("recipientName"),
            recipientEmail: pick("recipientEmail"),
            personalMessage: pick("personalMessage"),
          });
          const pi = await stripe.paymentIntents.create({ amount: amountCents, currency: "usd", metadata, automatic_payment_methods: { enabled: true } });
          return reply.send({ clientSecret: pi.client_secret, id: pi.id, paymentIntentId: pi.id, amountCents });
        }

        // meal_gift: the giver is the verified caller; createMealGift checks this binding.
        const who = await customerAuth.requireUser(req, reply);
        if (!who) return reply;
        const amountCents = body.amountCents;
        if (!Number.isInteger(amountCents) || amountCents < MEAL_GIFT_MIN_CENTS || amountCents > MEAL_GIFT_MAX_CENTS) {
          throw new OrderError("AMOUNT_OUT_OF_RANGE", 400, "Amount must be between $15.99 and $35.00");
        }
        const locationId = body.locationId || md.locationId;
        if (typeof locationId !== "string" || !locationId) return reply.status(400).send({ error: "LOCATION_REQUIRED" });
        const pi = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          // Task D9 fix round 1: the whole gift rides on the PaymentIntent, so the
          // Stripe webhook can record it (POST /meal-gifts/confirm-payment) when
          // the giver's page never comes back.
          metadata: mealGiftMetadata({ giverId: who.userId, locationId, messageFromGiver: body.messageFromGiver, amountCents }),
          automatic_payment_methods: { enabled: true },
        });
        return reply.send({ clientSecret: pi.client_secret, id: pi.id, paymentIntentId: pi.id, amountCents });
      } catch (err) {
        if (err instanceof OrderError) return reply.status(err.status).send({ error: err.code, message: err.message, ...err.extra });
        throw err;
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
