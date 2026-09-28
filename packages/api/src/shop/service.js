/**
 * Merch shop orders (Task D10a): the same rule as food orders (A6/A7).
 * The server decides every amount, and an order is PAID only after a
 * server-verified Stripe PaymentIntent or a server-verified zero balance.
 *
 *  - createShopOrder prices each line from its ShopProduct row (never the
 *    client), adds shipping and tax, and RECORDS server-validated savings
 *    (credits capped by the member's unexpired CreditLots, a gift card by
 *    code); the total is net of them, but nothing is spent yet.
 *  - createShopPaymentIntent charges shopAmountDue(order), recomputed from the
 *    stored lines, with metadata { shopOrderId, kind: "shop" }.
 *  - confirmShopPayment retrieves the PaymentIntent and requires succeeded,
 *    the exact amount due and metadata.shopOrderId, then (fix round 1, the
 *    food-order pattern) one transaction marks PAID and spends credits
 *    (spendCreditInTx), the gift card and stock; a shortfall refunds in full.
 *    Idempotent (the Stripe webhook and the return page may both call it).
 *  - applyShopCredits works only on an unpaid, uncancelled order and raises
 *    the recorded credit conditionally; a zero balance spends and pays there.
 *
 * Shipping and tax are what the shop has always charged: $8.99 shipping
 * under $75 (SHIPPING only) and 8% tax on the subtotal after savings.
 */
import { OrderError, verifiedIntent, refundUnappliedPayment, giftCardCodeCandidates, STRIPE_MIN_CHARGE_CENTS } from "../orders/service.js";
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

/**
 * Order number prefix for shop orders that RECORD their savings and spend
 * them at PAID (D10a fix round 1+). Orders from before the change
 * ("SHOP-...") spent their credits, gift card and stock at creation, and
 * their creditsApplied/giftCardApplied columns (non-null, default 0) look the
 * same, so the prefix is what tells them apart without a migration.
 */
export const SHOP_ORDER_PREFIX = "SO-";

/** True when this order's savings and stock are still to be spent at PAID (not a legacy "SHOP-" order). */
export function spendsAtPaid(order) {
  return typeof order?.orderNumber === "string" && order.orderNumber.startsWith(SHOP_ORDER_PREFIX);
}

function generateShopOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${SHOP_ORDER_PREFIX}${timestamp}-${random}`;
}

async function loadItems(db, orderId) {
  return db.shopOrderItem.findMany({ where: { orderId } });
}

async function findProduct(prisma, ref) {
  if (typeof ref !== "string" || !ref) return null;
  return (await prisma.shopProduct.findUnique({ where: { id: ref } })) || (await prisma.shopProduct.findUnique({ where: { slug: ref } }));
}

/**
 * Spends what an order that is becoming PAID recorded: stock, the member's
 * credit and the gift card balance, all conditional. Runs inside the
 * caller's transaction; any shortfall throws (CreditShortError, or an
 * OrderError OUT_OF_STOCK / GIFT_CARD_CHANGED) so the whole settle rolls back.
 */
async function settleSavingsInTx(tx, order, items, now) {
  // Legacy orders already spent everything at creation: never a second time.
  if (!spendsAtPaid(order)) return;
  for (const item of items) {
    const product = await tx.shopProduct.findUnique({ where: { id: item.productId } });
    if (product && product.stockCount !== null && product.stockCount !== undefined) {
      const res = await tx.shopProduct.updateMany({ where: { id: item.productId, stockCount: { gte: item.quantity } }, data: { stockCount: { decrement: item.quantity } } });
      if (res.count !== 1) throw new OrderError("OUT_OF_STOCK", 409, "An item sold out before your payment finished.");
    }
  }
  if ((order.creditsApplied || 0) > 0) {
    // CreditEvent.orderId points at food orders; the shop order rides in metadata.
    await spendCreditInTx(tx, { userId: order.userId, amountCents: order.creditsApplied, orderId: null, now, description: `Credits applied to shop order ${order.orderNumber}`, metadata: { shopOrderId: order.id } });
  }
  if ((order.giftCardApplied || 0) > 0) {
    const res = await tx.giftCard.updateMany({
      where: {
        id: order.giftCardId,
        status: "ACTIVE",
        balanceCents: { gte: order.giftCardApplied },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { balanceCents: { decrement: order.giftCardApplied } },
    });
    if (res.count !== 1) throw new OrderError("GIFT_CARD_CHANGED", 409, "Your gift card balance changed before your payment finished.");
    const card = await tx.giftCard.findUnique({ where: { id: order.giftCardId } });
    if (card && card.balanceCents === 0) await tx.giftCard.update({ where: { id: card.id }, data: { status: "EXHAUSTED" } });
  }
}

/** Maps a settle shortfall to the 409 the client translates; anything else is returned as is. */
function asShortfall(err) {
  if (err instanceof CreditShortError) return new OrderError("CREDIT_SHORT", 409, "Your credit balance changed before your payment finished.", { availableCents: err.availableCents });
  return err;
}

const lineKey = (l) => `${l.productId}:${l.quantity}:${l.variant || ""}`;
const sameLines = (a, b) => a.length === b.length && a.map(lineKey).sort().join("|") === b.map(lineKey).sort().join("|");
export const SHOP_ORDER_REUSE_MS = 24 * 60 * 60 * 1000;

/**
 * Creates an unpaid shop order priced by the server. `owner` is the verified
 * caller ({ userId } member or { guestId } from a guest session); body ids
 * are never identity. Credits need a member; a gift card is named by its
 * code. The intended savings are RECORDED (and the total is net of them) but
 * nothing is spent and no stock moves until the order becomes PAID
 * (confirmShopPayment), as for food orders. A zero amount due is PAID here,
 * spending in the same transaction (server-verified zero balance).
 * The same owner's unpaid order for the same cart and savings (within a day)
 * is reused, so reloading checkout doesn't pile up orders.
 */
export async function createShopOrder(prisma, {
  owner = {},
  items,
  fulfillmentType,
  shipping = null,
  locationId = null,
  creditsToApply = 0,
  giftCardCode = null,
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
    lines.push({ productId: product.id, quantity, priceCents: product.priceCents, variant: typeof item.variant === "string" ? item.variant : null });
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
  if (typeof giftCardCode === "string" && giftCardCode.trim()) {
    card = await prisma.giftCard.findFirst({ where: { code: { in: giftCardCodeCandidates(giftCardCode) } } });
    const usable = card && card.status === "ACTIVE" && card.balanceCents > 0 && (!card.expiresAt || new Date(card.expiresAt) > now);
    if (!usable) throw new OrderError("GIFT_CARD_INVALID", 400, "That gift card can't be used.");
    giftCardApplied = Math.min(card.balanceCents, room);
  }

  const { shippingCents, taxCents, totalCents } = shopTotals({ subtotalCents, fulfillmentType, creditsApplied, giftCardApplied });
  if (totalCents > 0 && totalCents < STRIPE_MIN_CHARGE_CENTS) {
    throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: totalCents });
  }
  const giftCardId = giftCardApplied > 0 ? card.id : null;
  const shippingData = {
    shippingName: shipping?.name || null,
    shippingAddress1: shipping?.address1 || null,
    shippingAddress2: shipping?.address2 || null,
    shippingCity: shipping?.city || null,
    shippingState: shipping?.state || null,
    shippingZip: shipping?.zip || null,
    shippingCountry: shipping?.country || "US",
    shippingPhone: shipping?.phone || null,
    shippingEmail: shipping?.email || null,
  };

  // Reuse: the owner's unpaid order for this exact cart and savings.
  if (totalCents > 0 && (userId || guestId)) {
    const candidates = await prisma.shopOrder.findMany({
      where: {
        ...(userId ? { userId } : { guestId }),
        paymentStatus: "PENDING",
        fulfillmentStatus: { not: "CANCELLED" },
        fulfillmentType,
        subtotalCents,
        creditsApplied,
        giftCardApplied,
        giftCardId,
        locationId: locationId || null,
      },
    });
    const cutoff = now.getTime() - SHOP_ORDER_REUSE_MS;
    for (const existing of candidates) {
      if (!spendsAtPaid(existing)) continue;
      if (existing.createdAt && new Date(existing.createdAt).getTime() < cutoff) continue;
      const existingItems = await loadItems(prisma, existing.id);
      if (!sameLines(existingItems, lines)) continue;
      // Conditional: an order paid meanwhile is never rewritten.
      const res = await prisma.shopOrder.updateMany({ where: { id: existing.id, paymentStatus: "PENDING" }, data: shippingData });
      if (res.count !== 1) continue;
      const updated = await prisma.shopOrder.findUnique({ where: { id: existing.id } });
      return { ...updated, items: existingItems, reused: true };
    }
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
          giftCardId,
          fulfillmentType,
          ...shippingData,
          stripePaymentId: null,
          // Only a server-verified zero balance is paid without a PaymentIntent.
          paymentStatus: totalCents === 0 ? "PAID" : "PENDING",
          fulfillmentStatus: "PENDING",
        },
      });
      const created = [];
      for (const line of lines) {
        created.push(await tx.shopOrderItem.create({ data: { orderId: order.id, productId: line.productId, quantity: line.quantity, priceCents: line.priceCents, variant: line.variant } }));
      }
      if (totalCents === 0) await settleSavingsInTx(tx, order, created, now);
      return { ...order, items: created };
    });
  } catch (err) {
    throw asShortfall(err);
  }
}

/**
 * Raises the credit recorded on the member's unpaid shop order (nothing is
 * spent until PAID). The update is conditional on the order still being
 * PENDING, uncancelled and holding the credit it had when read, so a
 * repeated or concurrent call can't stack. Covering the whole amount makes
 * the order PAID and spends in the same transaction (zero balance).
 */
export async function applyShopCredits(prisma, { orderId, userId, amountCents, now = new Date() }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new OrderError("AMOUNT_REQUIRED", 400, "amountCents required");
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.shopOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
      if (order.userId !== userId) throw new OrderError("FORBIDDEN", 403, "Forbidden");
      if (!isPending(order)) throw notPending();
      if (!spendsAtPaid(order)) throw new OrderError("LEGACY_ORDER", 409, "This order predates the current checkout; please place a new order.");
      const items = await loadItems(tx, orderId);
      const subtotalCents = subtotalOf(items);
      const already = order.creditsApplied || 0;
      const room = savingsRoom({ subtotalCents, fulfillmentType: order.fulfillmentType, creditsApplied: already, giftCardApplied: order.giftCardApplied || 0 });
      const apply = Math.min(amountCents, room, (await availableCredit(tx, userId, now)) - already);
      if (apply <= 0) throw new OrderError("NO_CREDITS_TO_APPLY", 400, "No credits to apply");

      const creditsApplied = already + apply;
      const totals = shopTotals({ subtotalCents, fulfillmentType: order.fulfillmentType, creditsApplied, giftCardApplied: order.giftCardApplied || 0 });
      if (totals.totalCents > 0 && totals.totalCents < STRIPE_MIN_CHARGE_CENTS) {
        throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: totals.totalCents });
      }
      const paidNow = totals.totalCents === 0;
      const updated = await tx.shopOrder.updateMany({
        where: { id: orderId, paymentStatus: "PENDING", fulfillmentStatus: { not: "CANCELLED" }, creditsApplied: already },
        data: { creditsApplied, taxCents: totals.taxCents, totalCents: totals.totalCents, ...(paidNow ? { paymentStatus: "PAID" } : {}) },
      });
      if (updated.count !== 1) throw new OrderError("ORDER_CHANGED", 409, "This order just changed. Please try again.");
      if (paidNow) await settleSavingsInTx(tx, { ...order, creditsApplied }, items, now);
      return { creditsApplied: apply, order: await tx.shopOrder.findUnique({ where: { id: orderId } }) };
    });
  } catch (err) {
    throw asShortfall(err);
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

const LOST_CLAIM = Symbol("lostClaim");

/**
 * Marks the shop order PAID for a verified PaymentIntent: succeeded, exactly
 * the amount due, metadata { shopOrderId: this order, kind: "shop" }. One
 * transaction claims PENDING -> PAID and spends the recorded credits, gift
 * card and stock; any shortfall rolls it all back and the charge is refunded
 * in FULL with a support case (409 CREDIT_SHORT / GIFT_CARD_CHANGED /
 * OUT_OF_STOCK, refunded:true). Idempotent: the same PaymentIntent again,
 * or losing a race to it, answers { alreadyPaid: true } without a refund
 * (the loser re-reads before refunding, as orders/service.js refundOnFailure).
 */
export async function confirmShopPayment(prisma, stripe, { orderId, paymentIntentId, now = new Date() }) {
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
  if (order.paymentStatus === "PAID" && paymentIntentId && order.stripePaymentId === paymentIntentId) {
    return { alreadyPaid: true, order };
  }
  const ours = (md) => md.shopOrderId === order.id && md.kind === SHOP_PAYMENT_KIND;
  // orderId here is only the support case's reference: the SHOP order number
  // (not a food order, so staff look it up under Shop orders).
  const refund = async (pi, code) => refundUnappliedPayment(prisma, stripe, { pi, orderId: order.orderNumber, userId: order.userId || null, code: `${code}; shop order ${order.orderNumber}, not a food order` });

  if (!isPending(order)) {
    // Already paid another way, or cancelled: a real charge for this order is returned.
    let extra = {};
    const raw = stripe && typeof paymentIntentId === "string" && paymentIntentId ? await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null) : null;
    if (raw && raw.status === "succeeded" && ours(raw.metadata || {}) && raw.id !== order.stripePaymentId) {
      extra = { refunded: (await refund(raw, "ORDER_NOT_PENDING")).refunded };
    }
    throw new OrderError("ORDER_NOT_PENDING", 409, "This order is already paid or cancelled.", extra);
  }

  const items = await loadItems(prisma, orderId);
  const amount = shopAmountDue(order, items);
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

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopOrder.updateMany({
        where: { id: orderId, paymentStatus: "PENDING", fulfillmentStatus: { not: "CANCELLED" }, totalCents: amount, creditsApplied: order.creditsApplied || 0, giftCardApplied: order.giftCardApplied || 0 },
        data: { paymentStatus: "PAID", stripePaymentId: pi.id },
      });
      if (claimed.count !== 1) throw LOST_CLAIM;
      await settleSavingsInTx(tx, order, items, now);
    });
  } catch (rawErr) {
    // Re-read first: if this PaymentIntent is already applied (a concurrent
    // confirm won), keep the money and answer alreadyPaid. If the re-read
    // fails, refund nothing (refunding an applied charge is the worse error).
    let fresh;
    try {
      fresh = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    } catch (readErr) {
      const summary = `NEEDS_REVIEW: payment ${pi.id} for SHOP order ${order.orderNumber} (a shop order number, not a food order) may or may not be applied; the order could not be re-read (${readErr?.message || readErr}). Not refunded. Check the shop order and refund in Stripe if it is unpaid.`;
      try {
        await prisma.supportCase.create({ data: { type: "ORDER_ISSUE", orderId: order.orderNumber, userId: order.userId || null, summary, amountCents: pi.amount ?? null } });
      } catch (caseErr) {
        console.error(`[shop] could not file NEEDS_REVIEW case for ${pi.id}:`, caseErr?.message || caseErr);
      }
      console.error(`[shop] ${summary}`);
      const err = rawErr === LOST_CLAIM ? new OrderError("ORDER_CHANGED", 409, "This order changed while it was being paid.") : asShortfall(rawErr);
      if (err instanceof OrderError) err.extra = { ...err.extra, refunded: false, needsReview: true };
      throw err;
    }
    if (fresh && fresh.paymentStatus === "PAID" && fresh.stripePaymentId === pi.id) return { alreadyPaid: true, order: fresh };
    const err = rawErr === LOST_CLAIM ? new OrderError("ORDER_CHANGED", 409, "This order changed while it was being paid.") : asShortfall(rawErr);
    const code = err instanceof OrderError ? err.code : `SETTLE_FAILED: ${err?.code || err?.name || "Error"}`;
    const r = await refund(pi, code);
    if (err instanceof OrderError) {
      err.extra = { ...err.extra, refunded: r.refunded };
      throw err;
    }
    throw new OrderError("SETTLE_FAILED", 500, "We couldn't finish your order.", { refunded: r.refunded });
  }
  return { alreadyPaid: false, order: await prisma.shopOrder.findUnique({ where: { id: orderId } }) };
}

/**
 * Staff PATCH /admin/shop/orders/:id may still set paymentStatus or
 * stripePaymentId (cash and manual corrections, fix round 1 ruling). Each
 * such change is appended to the order's adminNotes with who made it.
 * Returns the new adminNotes, or null when nothing payment-related changed.
 */
export function paymentAuditNotes(existing, updates, { adminUserId = null, adminRole = null, at = new Date() } = {}) {
  const changes = [];
  for (const field of ["paymentStatus", "stripePaymentId"]) {
    if (updates[field] !== undefined && updates[field] !== existing[field]) {
      changes.push(`${field} ${existing[field] ?? "none"} -> ${updates[field] ?? "none"}`);
    }
  }
  if (!changes.length) return null;
  const who = adminUserId ? `admin ${adminUserId}` : "admin (API key or dev)";
  const line = `[${at.toISOString()}] ${changes.join(", ")} by ${who}${adminRole ? ` (${adminRole})` : ""}`;
  const base = typeof updates.adminNotes === "string" ? updates.adminNotes : existing.adminNotes;
  return base ? `${base}\n${line}` : line;
}

const STAFF_SHORTFALL = {
  CREDIT_SHORT: "Customer credits are no longer available; edit the order or remove savings first.",
  GIFT_CARD_CHANGED: "The gift card no longer covers its recorded amount (spent or expired); edit the order or remove savings first.",
  OUT_OF_STOCK: "An item is out of stock; restock or edit the order first.",
};

/**
 * Staff manual PAID (PATCH /admin/shop/orders/:id, fix round 2): the same
 * settle as a verified card payment. One transaction claims PENDING -> PAID
 * (optionally recording a stripePaymentId) and spends the recorded stock,
 * credits and gift card. There is no PaymentIntent to refund, so a shortfall
 * rolls back and answers 409 with a message for the admin.
 */
export async function markShopOrderPaidByStaff(prisma, { orderId, stripePaymentId = null, now = new Date() }) {
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("NOT_FOUND", 404, "Order not found");
  if (order.paymentStatus === "PAID") return { alreadyPaid: true, order };
  if (!isPending(order)) throw new OrderError("ORDER_NOT_PENDING", 409, "Only an unpaid, uncancelled order can be marked paid.");
  const items = await loadItems(prisma, orderId);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopOrder.updateMany({
        where: { id: orderId, paymentStatus: "PENDING", fulfillmentStatus: { not: "CANCELLED" }, creditsApplied: order.creditsApplied || 0, giftCardApplied: order.giftCardApplied || 0 },
        data: { paymentStatus: "PAID", ...(stripePaymentId ? { stripePaymentId } : {}) },
      });
      if (claimed.count !== 1) throw new OrderError("ORDER_CHANGED", 409, "This order just changed; reload it and try again.");
      await settleSavingsInTx(tx, order, items, now);
    });
  } catch (rawErr) {
    const err = asShortfall(rawErr);
    if (err instanceof OrderError && STAFF_SHORTFALL[err.code]) throw new OrderError(err.code, 409, STAFF_SHORTFALL[err.code], err.extra);
    throw err;
  }
  return { alreadyPaid: false, order: await prisma.shopOrder.findUnique({ where: { id: orderId } }) };
}
