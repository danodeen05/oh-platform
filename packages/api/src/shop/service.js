/**
 * Merch shop orders (Task D10a): the same rule as food orders (A6/A7).
 * The server decides every amount, and an order is PAID only after a
 * server-verified Stripe PaymentIntent or a server-verified zero balance.
 *
 *  - createShopOrder prices each line from its ShopProduct row (never the
 *    client), adds shipping and tax, and takes server-validated savings:
 *    credits from the verified member's unexpired CreditLots (spendCreditInTx)
 *    and a gift card's own balance, both in the same transaction as the order.
 *  - createShopPaymentIntent charges shopAmountDue(order), recomputed from the
 *    stored lines, with metadata { shopOrderId, kind: "shop" }.
 *  - confirmShopPayment retrieves the PaymentIntent and requires succeeded,
 *    the exact amount due and metadata.shopOrderId; idempotent (the Stripe
 *    webhook and the return page may both call it).
 *  - applyShopCredits works only on an unpaid, uncancelled order and spends
 *    in the same transaction as the total update.
 *
 * Shipping and tax are what the shop has always charged: $8.99 shipping
 * under $75 (SHIPPING only) and 8% tax on the subtotal after savings.
 */
import { OrderError, verifiedIntent, refundUnappliedPayment, STRIPE_MIN_CHARGE_CENTS } from "../orders/service.js";
import { spendCreditInTx, availableCredit, CreditShortError } from "../membership/credits.js";

export const SHOP_SHIPPING_CENTS = 899;
export const SHOP_FREE_SHIPPING_MIN_CENTS = 7500;
export const SHOP_TAX_RATE = 0.08;
export const MAX_SHOP_LINES = 20;
export const MAX_SHOP_QUANTITY = 20;
export const SHOP_FULFILLMENT_TYPES = Object.freeze(["SHIPPING", "IN_STORE_PICKUP"]);
export const SHOP_PAYMENT_KIND = "shop";

const nonNegInt = (v) => (Number.isInteger(v) && v > 0 ? v : 0);

/** Shipping, tax and total for a subtotal and the savings already on the order. */
export function shopTotals({ subtotalCents, fulfillmentType, creditsApplied = 0, giftCardApplied = 0 }) {
  const shippingCents = fulfillmentType === "SHIPPING" && subtotalCents < SHOP_FREE_SHIPPING_MIN_CENTS ? SHOP_SHIPPING_CENTS : 0;
  const taxCents = Math.round(Math.max(0, subtotalCents - creditsApplied - giftCardApplied) * SHOP_TAX_RATE);
  const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - creditsApplied - giftCardApplied);
  return { shippingCents, taxCents, totalCents };
}

/** The most savings (credits plus gift card) an order can take: subtotal plus shipping, tax then being 0. */
export function savingsRoom({ subtotalCents, fulfillmentType, creditsApplied = 0, giftCardApplied = 0 }) {
  const { shippingCents } = shopTotals({ subtotalCents, fulfillmentType });
  return Math.max(0, subtotalCents + shippingCents - creditsApplied - giftCardApplied);
}

function subtotalOf(items) {
  return items.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);
}

/** What the order owes now, recomputed from its stored lines (each priced from its product at creation). */
export function shopAmountDue(order, items) {
  return shopTotals({
    subtotalCents: subtotalOf(items),
    fulfillmentType: order.fulfillmentType,
    creditsApplied: order.creditsApplied || 0,
    giftCardApplied: order.giftCardApplied || 0,
  }).totalCents;
}

function isPending(order) {
  return order.paymentStatus === "PENDING" && order.fulfillmentStatus !== "CANCELLED";
}

function notPending() {
  return new OrderError("ORDER_NOT_PENDING", 409, "This order is already paid or cancelled.");
}

function generateShopOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHOP-${timestamp}-${random}`;
}

async function loadItems(db, orderId) {
  return db.shopOrderItem.findMany({ where: { orderId } });
}

async function findProduct(prisma, ref) {
  if (typeof ref !== "string" || !ref) return null;
  return (await prisma.shopProduct.findUnique({ where: { id: ref } })) || (await prisma.shopProduct.findUnique({ where: { slug: ref } }));
}

/**
 * Creates an unpaid shop order priced by the server. `owner` is the verified
 * caller ({ userId } member or { guestId } from a guest session); body ids
 * are never identity. Credits need a member. A zero amount due is PAID here
 * (server-verified zero balance); anything else stays PENDING until
 * confirmShopPayment verifies its PaymentIntent.
 */
export async function createShopOrder(prisma, {
  owner = {},
  items,
  fulfillmentType,
  shipping = null,
  locationId = null,
  creditsToApply = 0,
  giftCardId = null,
  now = new Date(),
  generateOrderNumber = generateShopOrderNumber,
}) {
  const userId = owner.userId || null;
  const guestId = userId ? null : owner.guestId || null;
  if (!Array.isArray(items) || items.length === 0) throw new OrderError("ITEMS_REQUIRED", 400, "Items required");
  if (items.length > MAX_SHOP_LINES) throw new OrderError("TOO_MANY_ITEMS", 400, "Too many items");
  if (!SHOP_FULFILLMENT_TYPES.includes(fulfillmentType)) throw new OrderError("FULFILLMENT_TYPE_REQUIRED", 400, "Fulfillment type required");

  const lines = [];
  for (const item of items) {
    const quantity = item?.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SHOP_QUANTITY) {
      throw new OrderError("INVALID_QUANTITY", 400, "Each quantity must be a whole number from 1 to 20.");
    }
    const product = await findProduct(prisma, item.productId);
    if (!product) throw new OrderError("PRODUCT_NOT_FOUND", 400, `Product ${item.productId} not found`);
    if (!product.isAvailable) throw new OrderError("PRODUCT_UNAVAILABLE", 400, `Product ${product.name} is not available`);
    if (product.stockCount !== null && product.stockCount !== undefined && product.stockCount < quantity) {
      throw new OrderError("OUT_OF_STOCK", 400, `Insufficient stock for ${product.name}`);
    }
    lines.push({ productId: product.id, quantity, priceCents: product.priceCents, variant: typeof item.variant === "string" ? item.variant : null, tracked: product.stockCount !== null && product.stockCount !== undefined });
  }

  const subtotalCents = subtotalOf(lines);
  let room = savingsRoom({ subtotalCents, fulfillmentType });

  let creditsApplied = 0;
  const wantCredits = nonNegInt(creditsToApply);
  if (wantCredits > 0 && userId) {
    creditsApplied = Math.min(wantCredits, room, await availableCredit(prisma, userId, now));
    room -= creditsApplied;
  }

  let giftCardApplied = 0;
  let card = null;
  if (giftCardId) {
    card = await prisma.giftCard.findUnique({ where: { id: String(giftCardId) } });
    const usable = card && card.status === "ACTIVE" && card.balanceCents > 0 && (!card.expiresAt || new Date(card.expiresAt) > now);
    if (!usable) throw new OrderError("GIFT_CARD_INVALID", 400, "That gift card can't be used.");
    giftCardApplied = Math.min(card.balanceCents, room);
  }

  const { shippingCents, taxCents, totalCents } = shopTotals({ subtotalCents, fulfillmentType, creditsApplied, giftCardApplied });
  if (totalCents > 0 && totalCents < STRIPE_MIN_CHARGE_CENTS) {
    throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: totalCents });
  }
  const orderNumber = generateOrderNumber();

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.shopOrder.create({
        data: {
          orderNumber,
          userId,
          guestId,
          locationId: locationId || null,
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          creditsApplied,
          giftCardApplied,
          giftCardId: giftCardApplied > 0 ? card.id : null,
          fulfillmentType,
          shippingName: shipping?.name || null,
          shippingAddress1: shipping?.address1 || null,
          shippingAddress2: shipping?.address2 || null,
          shippingCity: shipping?.city || null,
          shippingState: shipping?.state || null,
          shippingZip: shipping?.zip || null,
          shippingCountry: shipping?.country || "US",
          shippingPhone: shipping?.phone || null,
          shippingEmail: shipping?.email || null,
          stripePaymentId: null,
          // Only a server-verified zero balance is paid without a PaymentIntent.
          paymentStatus: totalCents === 0 ? "PAID" : "PENDING",
          fulfillmentStatus: "PENDING",
        },
      });
      const created = [];
      for (const line of lines) {
        created.push(await tx.shopOrderItem.create({ data: { orderId: order.id, productId: line.productId, quantity: line.quantity, priceCents: line.priceCents, variant: line.variant } }));
        if (line.tracked) {
          const res = await tx.shopProduct.updateMany({ where: { id: line.productId, stockCount: { gte: line.quantity } }, data: { stockCount: { decrement: line.quantity } } });
          if (res.count !== 1) throw new OrderError("OUT_OF_STOCK", 409, "An item just sold out.");
        }
      }
      if (creditsApplied > 0) {
        // CreditEvent.orderId points at food orders; the shop order rides in metadata.
        await spendCreditInTx(tx, { userId, amountCents: creditsApplied, orderId: null, now, description: `Credits applied to shop order ${orderNumber}`, metadata: { shopOrderId: order.id } });
      }
      if (giftCardApplied > 0) {
        const res = await tx.giftCard.updateMany({ where: { id: card.id, status: "ACTIVE", balanceCents: { gte: giftCardApplied } }, data: { balanceCents: { decrement: giftCardApplied } } });
        if (res.count !== 1) throw new OrderError("GIFT_CARD_CHANGED", 409, "That gift card's balance changed. Please try again.");
        if (card.balanceCents - giftCardApplied === 0) await tx.giftCard.update({ where: { id: card.id }, data: { status: "EXHAUSTED" } });
      }
      return { ...order, items: created };
    });
  } catch (err) {
    if (err instanceof CreditShortError) throw new OrderError("CREDIT_SHORT", 409, "Your credit balance changed. Please try again.", { availableCents: err.availableCents });
    throw err;
  }
}

/**
 * Applies more of the member's credit to their unpaid shop order. The spend
 * and the total update share one transaction, and the update is conditional
 * on the order still being PENDING with the credits it had when read, so a
 * repeated or concurrent call can never spend twice. Covering the whole
 * amount makes the order PAID (server-verified zero balance).
 */
export async function applyShopCredits(prisma, { orderId, userId, amountCents, now = new Date() }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new OrderError("AMOUNT_REQUIRED", 400, "amountCents required");
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.shopOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
      if (order.userId !== userId) throw new OrderError("FORBIDDEN", 403, "Forbidden");
      if (!isPending(order)) throw notPending();
      const items = await loadItems(tx, orderId);
      const subtotalCents = subtotalOf(items);
      const room = savingsRoom({ subtotalCents, fulfillmentType: order.fulfillmentType, creditsApplied: order.creditsApplied || 0, giftCardApplied: order.giftCardApplied || 0 });
      const apply = Math.min(amountCents, room, await availableCredit(tx, userId, now));
      if (apply <= 0) throw new OrderError("NO_CREDITS_TO_APPLY", 400, "No credits to apply");

      const creditsApplied = (order.creditsApplied || 0) + apply;
      const totals = shopTotals({ subtotalCents, fulfillmentType: order.fulfillmentType, creditsApplied, giftCardApplied: order.giftCardApplied || 0 });
      if (totals.totalCents > 0 && totals.totalCents < STRIPE_MIN_CHARGE_CENTS) {
        throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: totals.totalCents });
      }
      const updated = await tx.shopOrder.updateMany({
        where: { id: orderId, paymentStatus: "PENDING", creditsApplied: order.creditsApplied || 0 },
        data: { creditsApplied, taxCents: totals.taxCents, totalCents: totals.totalCents, ...(totals.totalCents === 0 ? { paymentStatus: "PAID" } : {}) },
      });
      if (updated.count !== 1) throw new OrderError("ORDER_CHANGED", 409, "This order just changed. Please try again.");
      await spendCreditInTx(tx, { userId, amountCents: apply, orderId: null, now, description: `Credits applied to shop order ${order.orderNumber}`, metadata: { shopOrderId: orderId } });
      return { creditsApplied: apply, order: await tx.shopOrder.findUnique({ where: { id: orderId } }) };
    });
  } catch (err) {
    if (err instanceof CreditShortError) throw new OrderError("CREDIT_SHORT", 409, "Your credit balance changed. Please try again.", { availableCents: err.availableCents });
    throw err;
  }
}

/** A PaymentIntent for exactly what the unpaid order owes, never a client amount. */
export async function createShopPaymentIntent(prisma, stripe, { orderId, customerUserId = null }) {
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
  if (!isPending(order)) throw notPending();
  const amount = shopAmountDue(order, await loadItems(prisma, orderId));
  if (amount === 0) return { clientSecret: null, paymentIntentId: null, amountDueCents: 0 };
  if (amount < STRIPE_MIN_CHARGE_CENTS) throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: amount });
  if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");

  let customer;
  if (order.userId && customerUserId && order.userId === customerUserId) {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    customer = user?.stripeCustomerId || undefined;
  }
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    customer,
    automatic_payment_methods: { enabled: true },
    metadata: { shopOrderId: order.id, kind: SHOP_PAYMENT_KIND, orderNumber: order.orderNumber },
  });
  return { clientSecret: pi.client_secret, paymentIntentId: pi.id, amountDueCents: amount };
}

/**
 * Marks the shop order PAID for a verified PaymentIntent: succeeded, exactly
 * the amount due, metadata { shopOrderId: this order, kind: "shop" }.
 * Idempotent: the same PaymentIntent again answers { alreadyPaid: true }.
 * A charge for this order that can't be applied (a stale amount, an order
 * already paid another way) is refunded in full with a support case.
 */
export async function confirmShopPayment(prisma, stripe, { orderId, paymentIntentId }) {
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
  if (order.paymentStatus === "PAID" && paymentIntentId && order.stripePaymentId === paymentIntentId) {
    return { alreadyPaid: true, order };
  }
  const ours = (md) => md.shopOrderId === order.id && md.kind === SHOP_PAYMENT_KIND;
  const refund = async (pi, code) => refundUnappliedPayment(prisma, stripe, { pi, orderId: null, userId: order.userId || null, code: `${code} (shop order ${order.orderNumber})` });

  if (!isPending(order)) {
    // Already paid another way, or cancelled: a real charge for this order is returned.
    let extra = {};
    const raw = stripe && typeof paymentIntentId === "string" && paymentIntentId ? await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null) : null;
    if (raw && raw.status === "succeeded" && ours(raw.metadata || {}) && raw.id !== order.stripePaymentId) {
      extra = { refunded: (await refund(raw, "ORDER_NOT_PENDING")).refunded };
    }
    throw new OrderError("ORDER_NOT_PENDING", 409, "This order is already paid or cancelled.", extra);
  }

  const amount = shopAmountDue(order, await loadItems(prisma, orderId));
  let pi;
  try {
    pi = await verifiedIntent(stripe, paymentIntentId, { amount, matchesMetadata: ours });
  } catch (err) {
    if (err?.chargedIntent) {
      const r = await refund(err.chargedIntent, "SHOP_AMOUNT_MISMATCH");
      err.extra = { ...err.extra, refunded: r.refunded };
    }
    throw err;
  }

  const settled = await prisma.shopOrder.updateMany({
    where: { id: orderId, paymentStatus: "PENDING", totalCents: amount },
    data: { paymentStatus: "PAID", stripePaymentId: pi.id },
  });
  const fresh = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (settled.count === 1) return { alreadyPaid: false, order: fresh };
  // Lost a race: the webhook and the return page both confirmed the same payment.
  if (fresh.paymentStatus === "PAID" && fresh.stripePaymentId === pi.id) return { alreadyPaid: true, order: fresh };
  const r = await refund(pi, "ORDER_CHANGED");
  throw new OrderError("ORDER_CHANGED", 409, "This order changed while it was being paid.", { refunded: r.refunded });
}
