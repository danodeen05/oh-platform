/**
 * Shared order service (Task A6): the only code that prices, creates and
 * pays a dine-in food order. The web order flow, the kiosk and Chappy all
 * call it.
 *
 * Payment integrity:
 *  - The server alone prices an order (quoteOrder). The quote is stored on
 *    the order (subtotal, tax, total, every saving, amountDueCents).
 *  - A PaymentIntent is only ever created for order.amountDueCents, with
 *    metadata.orderId (createPaymentIntent).
 *  - An order becomes PAID only in markPaid, after the server has retrieved
 *    the PaymentIntent and checked status "succeeded", the exact amount and
 *    metadata.orderId, or after a server-verified zero balance.
 *  - markPaid is idempotent: the PAID flip is a conditional updateMany, so
 *    the Stripe webhook and the return page can both confirm and only one
 *    wins. Everything it spends (credit lots, a reward, a gift card, a meal
 *    gift) is re-validated inside the same transaction; if any fell short
 *    since the quote, the whole thing rolls back and the order stays unpaid.
 *  - Cashback and referral payouts are NOT paid here: they happen when the
 *    order reaches COMPLETED (membership/engine.js onOrderCompleted).
 */
import { priceLines, computeTotals, rewardDiscountCents, bowlCount, spendBaseCents, PricingError, MAX_CREDITS_PER_ORDER_CENTS } from "./pricing.js";
import { availableCredit, spendCreditInTx, CreditShortError } from "../membership/credits.js";
import { firstUnreleasedItem, redeemReward, onOrderCompleted as engineOnOrderCompleted } from "../membership/engine.js";
import { canAcceptOrders, validateArrivalTime } from "../utils/operating-hours.js";
import { notifyTierUpIfNeeded } from "../notifications.js";

export const DINE_IN_DISABLED_MESSAGE = "Online ordering is currently unavailable. Please visit us in person.";
/** How long a pod is held: while checking out, and again from payment (advertised as 10 minutes). */
export const POD_HOLD_MS = 15 * 60 * 1000;
/** Stripe's smallest card charge in USD. */
export const STRIPE_MIN_CHARGE_CENTS = 50;
export const MAX_ORDER_LINES = 60;
export const MAX_KIOSK_BATCH = 10;

/**
 * A refusal the routes turn into `{ error: code, message, ...extra }` with
 * HTTP `status`. `code` is a stable, translatable key (CREDIT_SHORT,
 * POD_UNAVAILABLE, ...); clients translate it, never the message.
 */
export class OrderError extends Error {
  constructor(code, status, message = code, extra = {}) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export class PodUnavailableError extends OrderError {
  constructor(label = null) {
    super("POD_UNAVAILABLE", 409, "That pod was just taken. Pick another or let us choose.", label ? { label } : {});
    this.name = "PodUnavailableError";
  }
}

// Runtime wiring from index.js: the dine-in flag and the PAID side effects
// (confirmation SMS, badges, wallet passes). Tests pass their own per call.
const config = {
  isDineInOrdersEnabled: () => true,
  effects: {},
};

export function configureOrderService({ isDineInOrdersEnabled, effects } = {}) {
  if (isDineInOrdersEnabled) config.isDineInOrdersEnabled = isDineInOrdersEnabled;
  if (effects) config.effects = effects;
}

export function defaultEffects() {
  return config.effects;
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

function nonNegativeInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

async function resolvePromo(prisma, { promoCode, promoCodeId, userId, locationId, subtotalCents, now }) {
  let promo = null;
  if (promoCodeId) promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  else if (typeof promoCode === "string" && promoCode.trim()) promo = await prisma.promoCode.findUnique({ where: { code: promoCode.trim().toUpperCase() } });
  else return { ok: false, promo: null };

  // Same rules as POST /promo-codes/validate (scope MENU).
  const valid =
    promo &&
    promo.isActive &&
    !(promo.startsAt && promo.startsAt > now) &&
    !(promo.expiresAt && promo.expiresAt < now) &&
    (promo.scope === "ALL" || promo.scope === "MENU") &&
    !(promo.totalUsageLimit && promo.currentUsageCount >= promo.totalUsageLimit) &&
    !(promo.minimumOrderCents && subtotalCents < promo.minimumOrderCents) &&
    !((promo.locationIds || []).length > 0 && !promo.locationIds.includes(locationId));
  if (!valid) return { ok: false, promo: null, invalid: true };
  // Final review I5: every promo has a per-user limit (perUserLimit is
  // non-null, default 1), and a guest can't be counted, so a promo needs a
  // signed-in member. settleInTx re-checks both limits at PAID.
  if (!userId) return { ok: false, promo: null, invalid: true, signInRequired: true };
  const used = await prisma.promoCodeUsage.count({ where: { promoCodeId: promo.id, userId } });
  if (used >= (promo.perUserLimit ?? 1)) return { ok: false, promo: null, invalid: true };
  return { ok: true, promo };
}

/** Stored codes are XXXX-XXXX-XXXX-XXXX; customers type them with or without dashes. */
export function giftCardCodeCandidates(input) {
  const raw = String(input).trim();
  const upper = raw.toUpperCase();
  const alnum = upper.replace(/[^A-Z0-9]/g, "");
  const dashed = alnum.length === 16 ? `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}-${alnum.slice(8, 12)}-${alnum.slice(12, 16)}` : upper;
  return [...new Set([raw, upper, dashed])];
}

async function resolveGiftCard(prisma, { giftCardCode, giftCardId, now }) {
  let card = null;
  if (giftCardId) card = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  else if (typeof giftCardCode === "string" && giftCardCode.trim()) {
    card = await prisma.giftCard.findFirst({ where: { code: { in: giftCardCodeCandidates(giftCardCode) } } });
  } else return null;
  const usable = card && card.status === "ACTIVE" && card.balanceCents > 0 && !(card.expiresAt && card.expiresAt <= now);
  return usable ? card : false;
}

/**
 * Task D5 fix round 3: a giver can never redeem their own gift. Unlike an
 * ordinary unavailable gift (which just drops the saving with a warning -
 * MEAL_GIFT_UNAVAILABLE), trying to use your own gift is a hard refusal: the
 * quote/order attempt is refused outright with 400 OWN_GIFT, so the client
 * shows a clear message rather than silently proceeding at full price.
 */
async function resolveMealGift(prisma, { mealGiftId, locationId, userId, now }) {
  if (!mealGiftId) return null;
  const gift = await prisma.mealGift.findUnique({ where: { id: mealGiftId } });
  if (gift && userId && gift.giverId === userId) {
    throw new OrderError("OWN_GIFT", 400, "You can't redeem your own gift.");
  }
  // Only a gift whose giver's payment was verified server-side (paidAt) is a tender.
  const usable = gift && gift.paidAt && gift.status === "PENDING" && gift.expiresAt > now && gift.locationId === locationId;
  return usable ? gift : false;
}

async function resolveReward(prisma, { rewardId, userId, now }) {
  if (!rewardId) return null;
  const reward = userId ? await prisma.reward.findUnique({ where: { id: rewardId } }) : null;
  if (!reward || reward.userId !== userId || reward.redeemedAt || reward.windowEndsAt <= now) {
    throw new OrderError("REWARD_UNAVAILABLE", 400, "That reward can't be used.");
  }
  return reward;
}

/**
 * Prices already-priced `lines` for `location` with every saving resolved
 * from the database. Shared by quoteOrder (fresh cart) and requoteOrder
 * (an unpaid order's stored lines). Reads only; never writes.
 */
async function buildQuote(prisma, { location, lines, menuItems, userId, promoCode, promoCodeId, useCreditsCents, rewardId, giftCardCode, giftCardId, mealGiftId, now }) {
  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  const warnings = [];
  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents, 0);

  const reward = await resolveReward(prisma, { rewardId, userId, now });
  let rewardCents = 0;
  if (reward) {
    const cents = rewardDiscountCents(lines, menuById, reward.type);
    if (cents === null) throw new OrderError("REWARD_NOT_APPLICABLE", 400, "Nothing in this order qualifies for that reward.");
    rewardCents = cents;
  }

  const promoResult = await resolvePromo(prisma, { promoCode, promoCodeId, userId, locationId: location.id, subtotalCents, now });
  if (promoResult.invalid) warnings.push("PROMO_INVALID");
  if (promoResult.signInRequired) warnings.push("PROMO_REQUIRES_SIGN_IN");

  const creditsRequestedCents = nonNegativeInt(useCreditsCents);
  let creditsAvailableCents = 0;
  if (creditsRequestedCents > 0) {
    if (userId) creditsAvailableCents = await availableCredit(prisma, userId, now);
    else warnings.push("CREDITS_REQUIRE_SIGN_IN");
  }

  const gift = await resolveMealGift(prisma, { mealGiftId, locationId: location.id, userId, now });
  if (gift === false) warnings.push("MEAL_GIFT_UNAVAILABLE");
  const card = await resolveGiftCard(prisma, { giftCardCode, giftCardId, now });
  if (card === false) warnings.push("GIFT_CARD_INVALID");

  const totals = computeTotals({
    subtotalCents,
    rewardCents,
    promo: promoResult.promo,
    bowls: Math.max(1, bowlCount(lines, menuById)),
    taxRate: location.taxRate,
    creditsRequestedCents,
    creditsAvailableCents,
    mealGiftCents: gift ? gift.amountCents : 0,
    giftCardBalanceCents: card ? card.balanceCents : 0,
  });
  const d = totals.discounts;

  return {
    locationId: location.id,
    tenantId: location.tenantId,
    userId: userId || null,
    lines,
    subtotalCents: totals.subtotalCents,
    discounts: d,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountDueCents: totals.amountDueCents,
    // The most member credit this order may use (Task D5 fix round 1: the site shows it, never hard-codes it).
    maxCreditsCents: MAX_CREDITS_PER_ORDER_CENTS,
    warnings,
    // What the order will record and markPaid will spend. A saving that
    // ended up worth $0 (e.g. credits already covered everything) is dropped
    // so it isn't consumed for nothing.
    applied: {
      promoCodeId: d.promoCents > 0 ? promoResult.promo.id : null,
      rewardId: d.rewardCents > 0 ? reward.id : null,
      rewardType: d.rewardCents > 0 ? reward.type : null,
      giftCardId: d.giftCardCents > 0 ? card.id : null,
      mealGiftId: d.mealGiftCents > 0 ? gift.id : null,
      mealGiftValueCents: d.mealGiftCents > 0 ? gift.amountCents : 0,
    },
  };
}

/**
 * The server's price for a cart. No writes. `userId` must be the verified
 * caller (it decides credits, rewards and early access), never a body field.
 */
export async function quoteOrder(prisma, { locationId, items, userId = null, promoCode, promoCodeId, useCreditsCents, rewardId, giftCardCode, giftCardId, mealGiftId, now = new Date() }) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ORDER_LINES) {
    throw new OrderError("ITEMS_REQUIRED", 400, "Add at least one item.");
  }
  if (items.some((i) => !i || typeof i.menuItemId !== "string")) throw new OrderError("ITEMS_REQUIRED", 400, "Every item needs a menuItemId.");
  if (!locationId || typeof locationId !== "string") throw new OrderError("LOCATION_REQUIRED", 400, "locationId required");
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new OrderError("LOCATION_NOT_FOUND", 404, "Location not found");

  const ids = [...new Set(items.map((i) => i.menuItemId))];
  // Only this location's tenant's available items: a cross-tenant or
  // unavailable id prices as "not found" below.
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids }, tenantId: location.tenantId, isAvailable: true } });

  let lines;
  try {
    lines = priceLines(menuItems, items);
  } catch (err) {
    if (err instanceof PricingError) throw new OrderError(err.code, 400, err.code === "ITEM_UNAVAILABLE" ? "That item isn't available." : "Invalid quantity.", { menuItemId: err.menuItemId });
    throw err;
  }

  // Early access (membership/engine.js): the same rule the menu listing uses,
  // so an item's id can't be ordered before the caller's tier can see it.
  const tier = userId ? (await prisma.user.findUnique({ where: { id: userId } }))?.membershipTier || null : null;
  const notReleasedYet = firstUnreleasedItem(menuItems, tier, now);
  if (notReleasedYet) throw new OrderError("ITEM_NOT_RELEASED", 400, "That item isn't released yet.", { menuItemId: notReleasedYet.id });

  return buildQuote(prisma, { location, lines, menuItems, userId, promoCode, promoCodeId, useCreditsCents, rewardId, giftCardCode, giftCardId, mealGiftId, now });
}

/** The Order columns a quote writes. */
function quoteColumns(quote) {
  const d = quote.discounts;
  return {
    subtotalCents: quote.subtotalCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    amountDueCents: quote.amountDueCents,
    creditsAppliedCents: d.creditsCents,
    promoCodeId: quote.applied.promoCodeId,
    promoDiscountCents: d.promoCents,
    rewardId: quote.applied.rewardId,
    rewardDiscountCents: d.rewardCents,
    giftCardId: quote.applied.giftCardId,
    giftCardAppliedCents: d.giftCardCents,
    mealGiftId: quote.applied.mealGiftId,
    mealGiftAppliedCents: d.mealGiftCents,
  };
}

// ---------------------------------------------------------------------------
// Pods
// ---------------------------------------------------------------------------

/**
 * Entry-nearest first. `bestRank` (Task A8: 1 = the free pod nearest the
 * entry by walking distance, computed offline by `@oh/floor-plan` and
 * persisted per seat) sorts first, nulls last for legacy/pre-comb seats that
 * don't have one. Within an equal `bestRank` (including "no bestRank on
 * either side"), fall back to the original finger-then-position order.
 */
export function podOrder(a, b) {
  const rank = (s) => (s.bestRank === null || s.bestRank === undefined ? Infinity : s.bestRank);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const key = (s) => [s.finger ?? 999, s.position ?? 999, String(s.number || "")];
  const [af, ap, an] = key(a);
  const [bf, bp, bn] = key(b);
  return af - bf || ap - bp || an.localeCompare(bn, undefined, { numeric: true });
}

export async function claimSeat(tx, seatId) {
  const res = await tx.seat.updateMany({ where: { id: seatId, status: "AVAILABLE", retiredAt: null }, data: { status: "RESERVED" } });
  return res.count === 1;
}

export async function releaseClaim(tx, seatId) {
  await tx.seat.updateMany({ where: { id: seatId, status: "RESERVED" }, data: { status: "AVAILABLE" } });
}

/**
 * Claims a pod for a checkout, race-safe: every claim is a conditional
 * `updateMany` (AVAILABLE and not retired -> RESERVED) that only one
 * concurrent transaction can win (count === 1). Call it inside the order's
 * transaction so a later failure releases the claim.
 *
 * - requestedLabel / requestedSeatId: that pod or PodUnavailableError.
 * - otherwise (best): the entry-nearest free pod; a party of 2+ gets both
 *   halves of a duo when one is free. PodUnavailableError when none is.
 * `arrival` is accepted for the interface; pod status is current-state, so
 * it doesn't change the pick yet.
 *
 * @returns {{ seat, partner: seat|null, method: "CUSTOMER_SELECTED"|"AUTO" }}
 */
// eslint-disable-next-line no-unused-vars
export async function pickBestPod(tx, { locationId, arrival = null, partySize = 1, requestedLabel = null, requestedSeatId = null, dual = false }) {
  const wantsDuo = partySize >= 2 || dual;

  if (requestedLabel || requestedSeatId) {
    const seat = requestedLabel
      ? await tx.seat.findFirst({ where: { locationId, label: requestedLabel, retiredAt: null } })
      : await tx.seat.findFirst({ where: { id: requestedSeatId, locationId, retiredAt: null } });
    if (!seat || !(await claimSeat(tx, seat.id))) throw new PodUnavailableError(requestedLabel || seat?.label || null);
    let partner = null;
    if (wantsDuo && seat.podType === "DUAL" && seat.dualPartnerId) {
      if (!(await claimSeat(tx, seat.dualPartnerId))) {
        await releaseClaim(tx, seat.id);
        throw new PodUnavailableError(requestedLabel || seat.label || null);
      }
      partner = await tx.seat.findUnique({ where: { id: seat.dualPartnerId } });
    }
    return { seat, partner, method: "CUSTOMER_SELECTED" };
  }

  const free = (await tx.seat.findMany({ where: { locationId, status: "AVAILABLE", retiredAt: null } })).sort(podOrder);
  const freeIds = new Set(free.map((s) => s.id));

  if (wantsDuo) {
    for (const seat of free) {
      if (seat.podType !== "DUAL" || !seat.dualPartnerId || !freeIds.has(seat.dualPartnerId)) continue;
      if (!(await claimSeat(tx, seat.id))) continue;
      if (!(await claimSeat(tx, seat.dualPartnerId))) {
        await releaseClaim(tx, seat.id);
        continue;
      }
      return { seat, partner: await tx.seat.findUnique({ where: { id: seat.dualPartnerId } }), method: "AUTO" };
    }
  }

  // A single diner takes a single pod before half a duo.
  const singlesFirst = [...free].sort((a, b) => (a.podType === "DUAL") - (b.podType === "DUAL") || podOrder(a, b));
  for (const seat of singlesFirst) {
    if (await claimSeat(tx, seat.id)) return { seat, partner: null, method: "AUTO" };
  }
  throw new PodUnavailableError();
}

const LIVE_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"];

/**
 * The shape of a duo share: `guest` (marked DUO_SHARED by POST
 * /kiosk/orders/:id/seat {shareWithOrderId}) sits at the other half of
 * `host`'s duo, both kiosk orders at one location. Shape alone proves nothing.
 */
function duoShareShape(host, guest) {
  if (!host || !guest || host.id === guest.id) return false;
  if (!host.isDualPod || !host.dualPartnerSeatId || guest.seatId !== host.dualPartnerSeatId) return false;
  if (guest.podSelectionMethod !== "DUO_SHARED") return false;
  return host.orderSource === "KIOSK" && guest.orderSource === "KIOSK" && host.locationId === guest.locationId;
}

/**
 * Task D12 fix round 4: the pay-time proof that two orders are one kiosk
 * party is the payment itself. A kiosk party pays through ONE batch
 * (kioskPaymentIntent(orderIds) / markPaidBatch): `other` counts as this
 * order's party when it is settled in this same batch (ctx.batchIds), or was
 * already PAID by this same PaymentIntent.
 */
function paidInSameBatch(other, ctx) {
  if (ctx.batchIds && ctx.batchIds.includes(other.id)) return true;
  return Boolean(ctx.paymentIntentId && other.paymentStatus === "PAID" && other.stripePaymentId === ctx.paymentIntentId);
}

/**
 * Does `other` pointing at one of `order`'s seats NOT count as a conflict?
 * - `order` holds the duo and `other` merely sits on its partner half: not a
 *   conflict for `order` (the host claimed that half itself); `other` is
 *   checked when it pays.
 * - `order` is the one sitting on `other`'s partner half: only with the batch proof.
 */
function sharesDuo(order, other, ctx) {
  if (duoShareShape(order, other)) return true;
  return duoShareShape(other, order) && paidInSameBatch(other, ctx);
}

export const DUO_SHARE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Claim-time soft hold (Task D12 fix round 3), used by POST
 * /kiosk/orders/:id/seat: the share has the duo shape, and the two orders
 * were created within 30 minutes of each other. Orders carry no party or
 * device id, so this is a heuristic; pay time re-checks with the batch proof.
 */
export function isPartyDuoShare(host, guest) {
  if (!duoShareShape(host, guest)) return false;
  const t = (d) => (d ? new Date(d).getTime() : NaN);
  return Math.abs(t(host.createdAt) - t(guest.createdAt)) <= DUO_SHARE_WINDOW_MS;
}

/** Pay context: the orders settled together and the PaymentIntent that pays them. */
function payContext(order, ctx = {}) {
  return { batchIds: ctx.batchIds || [order.id], paymentIntentId: ctx.paymentIntentId ?? order.stripePaymentId ?? null };
}

/**
 * Is `seatId` still this order's to keep at pay time? Yes when no other live
 * order points at it (a proven party share doesn't count, see sharesDuo) and
 * it is either still RESERVED (this order's hold, even if its expiry passed
 * before the release job ran) or free and re-claimed now with claimSeat.
 */
export async function holdSeatForOrder(tx, order, seatId, ctx = {}) {
  const pay = payContext(order, ctx);
  const others = await tx.order.findMany({
    where: { id: { not: order.id }, status: { in: LIVE_ORDER_STATUSES }, OR: [{ seatId }, { dualPartnerSeatId: seatId }] },
  });
  if (others.some((o) => !sharesDuo(order, o, pay))) return false;
  const seat = await tx.seat.findUnique({ where: { id: seatId } });
  if (!seat || seat.retiredAt) return false;
  if (seat.status === "RESERVED") return true;
  if (seat.status === "AVAILABLE") return claimSeat(tx, seatId);
  return false; // OCCUPIED or CLEANING: someone is at it
}

/**
 * The pod part of the PAID transition (Task D12 fix rounds 2 to 4). Keeps
 * the order's pod when it is still held for it, re-claims it when it was
 * freed, and otherwise assigns the next best pod with pickBestPod (same party
 * size and duo rule, same arrival). No free pod: the order stays PAID with no
 * seat and a POD_ISSUE support case tells staff. Never throws over a pod:
 * payment must not fail because of seating.
 *
 * A duo host that moves takes its party guest (the DUO_SHARED order on its
 * old partner half, settled in this same batch) to the new duo's other half.
 * When the new pod is a single, the guest stays where it is and
 * `partyLeftAt` says so.
 *
 * `ctx`: { batchIds, paymentIntentId } for a batch settle; defaults to this order alone.
 * @returns {{ changed: boolean, noPod?: boolean, from: string|null, to?: string|null, partyMoved?: object[], partyLeftAt?: string|null }}
 */
export async function holdPodAtPay(tx, order, now = new Date(), ctx = {}) {
  const pay = payContext(order, ctx);
  const seatIds = [order.seatId, ...(order.isDualPod && order.dualPartnerSeatId ? [order.dualPartnerSeatId] : [])];
  const previous = await tx.seat.findUnique({ where: { id: order.seatId } });
  const from = previous ? previous.label || previous.number || null : null;

  let ok = true;
  for (const id of seatIds) {
    if (!(await holdSeatForOrder(tx, order, id, pay))) { ok = false; break; }
  }
  if (ok) return { changed: false, from };

  // This order's party guest on its old partner half, if any (proven by the batch).
  const partyGuests = order.isDualPod && order.dualPartnerSeatId
    ? (await tx.order.findMany({ where: { id: { not: order.id }, status: { in: LIVE_ORDER_STATUSES }, seatId: order.dualPartnerSeatId } }))
        .filter((g) => duoShareShape(order, g) && paidInSameBatch(g, pay))
    : [];

  // Lost at least one seat: let go of every seat of this order that no other
  // live order points at (checked for all of them, so losing the FIRST half of
  // a duo doesn't strand the second), then pick again.
  for (const id of seatIds) {
    const others = await tx.order.count({ where: { id: { not: order.id }, status: { in: LIVE_ORDER_STATUSES }, OR: [{ seatId: id }, { dualPartnerSeatId: id }] } });
    if (others === 0) await releaseClaim(tx, id);
  }
  let pod = null;
  try {
    pod = await pickBestPod(tx, { locationId: order.locationId, arrival: order.estimatedArrival || null, partySize: order.isDualPod ? 2 : 1 });
  } catch (err) {
    if (!(err instanceof PodUnavailableError)) throw err;
  }
  if (!pod) {
    await tx.order.update({ where: { id: order.id }, data: { seatId: null, isDualPod: false, dualPartnerSeatId: null, podReservationExpiry: null, podReleasedAt: now, podReleasedNumber: from } });
    await tx.supportCase.create({
      data: {
        type: "POD_ISSUE",
        status: "OPEN",
        summary: `No pod available at pay time for order #${order.orderNumber || order.id}${from ? ` (its hold on Pod ${from} had lapsed)` : ""}. Seat the guest when they arrive.`,
        userId: order.userId || null,
        orderId: order.id,
        amountCents: null,
      },
    });
    return { changed: true, noPod: true, from, to: null, ...(partyGuests.length ? { partyLeftAt: seatLabelOf(await tx.seat.findUnique({ where: { id: order.dualPartnerSeatId } })) } : {}) };
  }
  await tx.order.update({
    where: { id: order.id },
    data: {
      seatId: pod.seat.id,
      isDualPod: Boolean(pod.partner),
      dualPartnerSeatId: pod.partner ? pod.partner.id : null,
      podSelectionMethod: "AUTO",
      podAssignedAt: now,
      podReleasedAt: now,
      podReleasedNumber: from,
    },
  });
  const result = { changed: true, from, to: seatLabelOf(pod.seat) };
  if (partyGuests.length) {
    const oldHalf = await tx.seat.findUnique({ where: { id: order.dualPartnerSeatId } });
    if (pod.partner) {
      // Move the party guest to the new duo's other half (already claimed with the host's pick).
      const guest = partyGuests[0];
      await tx.order.update({ where: { id: guest.id }, data: { seatId: pod.partner.id, podAssignedAt: now, podReleasedAt: now, podReleasedNumber: seatLabelOf(oldHalf) } });
      const stillUsed = await tx.order.count({ where: { status: { in: LIVE_ORDER_STATUSES }, OR: [{ seatId: order.dualPartnerSeatId }, { dualPartnerSeatId: order.dualPartnerSeatId }] } });
      if (stillUsed === 0) await releaseClaim(tx, order.dualPartnerSeatId);
      result.partyMoved = [{ orderId: guest.id, from: seatLabelOf(oldHalf), to: seatLabelOf(pod.partner) }];
    } else {
      result.partyLeftAt = seatLabelOf(oldHalf);
    }
  }
  return result;
}

const seatLabelOf = (seat) => (seat ? seat.label || seat.number || null : null);

/** Carries a preview's result out of the transaction that is being rolled back. */
class PodPreview {
  constructor(value) {
    this.value = value;
  }
}

/**
 * What pickBestPod WOULD pick right now, with nothing claimed: the pick runs
 * inside a transaction that is always rolled back (Chappy's
 * set_arrival_and_pod, Task B2). Same arguments as pickBestPod; throws
 * PodUnavailableError the same way. The real claim happens in createOrder.
 */
export async function previewPod(prisma, args) {
  try {
    await prisma.$transaction(async (tx) => {
      throw new PodPreview(await pickBestPod(tx, args));
    });
  } catch (err) {
    if (err instanceof PodPreview) return err.value;
    throw err;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function randomTag(n) {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase();
}

/**
 * Creates an unpaid order from a server quote. Enforces the dine-in flag,
 * ordering hours and the arrival time (America/Denver via the location's
 * timezone), and claims a pod when one is requested.
 *
 * group: { groupOrderId, isGroupHost } for a group member's order (Task A7).
 *
 * seatRequest: null (no pod yet; assigned at check-in), {label}, {seatId}
 * (legacy web/kiosk callers), or {best: true}. An explicit pod that is taken
 * is PodUnavailableError; {best:true} with nothing free creates the order
 * without a pod (the queue assigns one at check-in).
 */
export async function createOrder(prisma, {
  quote,
  locationId,
  tenantId = null,
  userId = null,
  guestId = null,
  guestName = null,
  estimatedArrival = null,
  seatRequest = null,
  partySize = 1,
  source = "WEB",
  group = null,
  now = new Date(),
  isDineInOrdersEnabled = config.isDineInOrdersEnabled,
}) {
  if (!isDineInOrdersEnabled()) throw new OrderError("DINE_IN_DISABLED", 403, DINE_IN_DISABLED_MESSAGE);
  if (!quote || quote.locationId !== locationId) throw new OrderError("QUOTE_MISMATCH", 400, "Quote is for another location.");
  if ((quote.userId || null) !== (userId || null)) throw new OrderError("QUOTE_MISMATCH", 400, "Quote is for another customer.");

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new OrderError("LOCATION_NOT_FOUND", 404, "Location not found");
  if (tenantId && tenantId !== location.tenantId) throw new OrderError("TENANT_MISMATCH", 400, "Location belongs to another tenant.");
  if (!canAcceptOrders(location, now)) throw new OrderError("ORDERING_CLOSED", 409, "Online ordering is closed right now.");

  let arrival = null;
  if (estimatedArrival) {
    arrival = new Date(estimatedArrival);
    if (Number.isNaN(arrival.getTime())) throw new OrderError("ARRIVAL_INVALID", 400, "Invalid arrival time.");
    const minutesFromNow = Math.max(0, Math.round((arrival.getTime() - now.getTime()) / 60000));
    const check = validateArrivalTime(location, minutesFromNow, now);
    if (!check.valid) throw new OrderError("ARRIVAL_INVALID", 400, check.reason || "Invalid arrival time.");
  }

  const order = await prisma.$transaction(async (tx) => {
    let pod = null;
    if (seatRequest && (seatRequest.label || seatRequest.seatId || seatRequest.best)) {
      try {
        pod = await pickBestPod(tx, {
          locationId,
          arrival,
          partySize,
          requestedLabel: seatRequest.label || null,
          requestedSeatId: seatRequest.seatId || null,
          dual: Boolean(seatRequest.dual),
        });
      } catch (err) {
        if (!(err instanceof PodUnavailableError) || !seatRequest.best) throw err;
        pod = null;
      }
    }

    let resolvedGuestId = guestId || null;
    if (!resolvedGuestId && guestName) {
      const guest = await tx.guest.create({
        data: {
          name: guestName,
          sessionToken: `kiosk-${now.getTime()}-${Math.random().toString(36).slice(2, 11)}`,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      });
      resolvedGuestId = guest.id;
    }

    // Daily kitchen number (0001-9999 per location per day), as before.
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const paidToday = await tx.order.count({ where: { locationId, paymentStatus: "PAID", createdAt: { gte: dayStart, lt: dayEnd } } });

    const created = await tx.order.create({
      data: {
        orderNumber: `ORD-${now.getTime()}-${randomTag(6)}`,
        orderQrCode: `ORDER-${locationId.slice(-8)}-${now.getTime()}-${randomTag(6)}`,
        kitchenOrderNumber: String(paidToday + 1).padStart(4, "0"),
        tenantId: location.tenantId,
        locationId,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        orderSource: source,
        ...quoteColumns(quote),
        estimatedArrival: arrival,
        userId: userId || null,
        guestId: resolvedGuestId,
        guestName: guestName || null,
        seatId: pod ? pod.seat.id : null,
        podSelectionMethod: pod ? pod.method : null,
        podAssignedAt: pod ? now : null,
        podReservationExpiry: pod ? new Date(now.getTime() + POD_HOLD_MS) : null,
        isDualPod: Boolean(pod?.partner),
        dualPartnerSeatId: pod?.partner ? pod.partner.id : null,
        // A group member's order (Task A7): same quote, tied to the group.
        ...(group?.groupOrderId ? { groupOrderId: group.groupOrderId, isGroupHost: Boolean(group.isGroupHost) } : {}),
      },
    });
    await tx.orderItem.createMany({ data: quote.lines.map((l) => ({ orderId: created.id, menuItemId: l.menuItemId, quantity: l.quantity, priceCents: l.priceCents, selectedValue: l.selectedValue ?? null })) });
    return created;
  });

  return order;
}

// ---------------------------------------------------------------------------
// Re-quote an unpaid order (the payment page's savings)
// ---------------------------------------------------------------------------

function loadPayableOrder(order) {
  if (!order) throw new OrderError("ORDER_NOT_FOUND", 404, "Order not found");
  if (order.paymentStatus === "PAID") throw new OrderError("ALREADY_PAID", 409, "This order is already paid.");
  if (order.status === "CANCELLED") throw new OrderError("ORDER_CANCELLED", 409, "This order was cancelled.");
  if (order.amountDueCents === null || order.amountDueCents === undefined) {
    throw new OrderError("LEGACY_ORDER", 409, "This order was created before server pricing; please start a new order.");
  }
  return order;
}

/**
 * Re-prices an unpaid order's stored lines with changed savings and writes
 * the new quote. Nothing is spent here; markPaid spends. Only the order's
 * verified owner may change credits or the reward.
 *
 * changes: { useCreditsCents?, rewardId?, promoCode?, giftCardCode?, mealGiftId? }
 * (a key that is absent keeps what the order has; null/"" removes it)
 */
export async function requoteOrder(prisma, { orderId, userId = null, changes = {}, now = new Date() }) {
  const order = loadPayableOrder(await prisma.order.findUnique({ where: { id: orderId } }));
  const has = (k) => Object.prototype.hasOwnProperty.call(changes, k);
  const memberChange = (has("useCreditsCents") && nonNegativeInt(changes.useCreditsCents) > 0) || (has("rewardId") && changes.rewardId);
  if (memberChange && (!userId || order.userId !== userId)) {
    throw new OrderError("FORBIDDEN", 403, "Only the order's owner can use credits or rewards on it.");
  }
  // A member's order: only that member may add, change or remove any saving.
  if (order.userId && Object.keys(changes).length > 0 && userId !== order.userId) {
    throw new OrderError("FORBIDDEN", 403, "Only the order's owner can change its savings.");
  }

  const location = await prisma.location.findUnique({ where: { id: order.locationId } });
  if (!location) throw new OrderError("LOCATION_NOT_FOUND", 404, "Location not found");
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: [...new Set(items.map((i) => i.menuItemId))] } } });
  const lines = items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, priceCents: i.priceCents, selectedValue: i.selectedValue ?? null }));

  const quote = await buildQuote(prisma, {
    location,
    lines,
    menuItems,
    userId: order.userId || null,
    promoCode: has("promoCode") ? changes.promoCode || null : undefined,
    promoCodeId: has("promoCode") ? undefined : order.promoCodeId,
    useCreditsCents: has("useCreditsCents") ? changes.useCreditsCents : order.creditsAppliedCents,
    rewardId: has("rewardId") ? changes.rewardId || null : order.rewardId,
    giftCardCode: has("giftCardCode") ? changes.giftCardCode || null : undefined,
    giftCardId: has("giftCardCode") ? undefined : order.giftCardId,
    mealGiftId: has("mealGiftId") ? changes.mealGiftId || null : order.mealGiftId,
    now,
  });

  // Conditional write: never re-price an order that has been paid meanwhile.
  const written = await prisma.order.updateMany({ where: { id: orderId, paymentStatus: { not: "PAID" } }, data: quoteColumns(quote) });
  if (written.count !== 1) throw new OrderError("ALREADY_PAID", 409, "This order is already paid.");
  const updated = await prisma.order.findUnique({ where: { id: orderId } });
  return { order: updated, quote };
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/** Throws the matching 409 when a saving recorded on the order can no longer be spent. */
async function assertSavingsStillAvailable(prisma, order, now) {
  if (order.creditsAppliedCents > 0) {
    const available = order.userId ? await availableCredit(prisma, order.userId, now) : 0;
    if (available < order.creditsAppliedCents) throw new OrderError("CREDIT_SHORT", 409, "Your credit balance changed. Review your order total.", { availableCents: available });
  }
  if (order.giftCardId && order.giftCardAppliedCents > 0) {
    const card = await prisma.giftCard.findUnique({ where: { id: order.giftCardId } });
    if (!card || card.status !== "ACTIVE" || card.balanceCents < order.giftCardAppliedCents) throw new OrderError("GIFT_CARD_SHORT", 409, "The gift card balance changed.");
  }
  if (order.mealGiftId && order.mealGiftAppliedCents > 0) {
    const gift = await prisma.mealGift.findUnique({ where: { id: order.mealGiftId } });
    if (!gift || !gift.paidAt || gift.status !== "PENDING" || gift.expiresAt <= now) throw new OrderError("MEAL_GIFT_UNAVAILABLE", 409, "That meal gift is no longer available.");
  }
  if (order.rewardId) {
    const reward = await prisma.reward.findUnique({ where: { id: order.rewardId } });
    if (!reward || reward.userId !== order.userId || reward.redeemedAt || reward.windowEndsAt <= now) throw new OrderError("REWARD_UNAVAILABLE", 409, "That reward can't be used.");
  }
}

/**
 * A PaymentIntent for the order's amount due, never a client amount.
 * Re-checks the recorded savings first so a card isn't charged for a quote
 * that can no longer be honored. Zero due: no PaymentIntent (clientSecret null).
 * `noRedirects` (Chappy's pay card, Task E2 fix round 1): only payment methods
 * that finish in the page (cards, Apple Pay, Google Pay; 3DS still resolves in
 * Stripe's frame). The web checkout leaves it off and keeps every method.
 */
export async function createPaymentIntent(prisma, stripe, { orderId, userId = null, savePaymentMethod = false, noRedirects = false, now = new Date() }) {
  const order = loadPayableOrder(await prisma.order.findUnique({ where: { id: orderId } }));
  const amount = order.amountDueCents;
  if (amount === 0) return { clientSecret: null, paymentIntentId: null, amountDueCents: 0 };
  if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
  await assertSavingsStillAvailable(prisma, order, now);
  if (amount < STRIPE_MIN_CHARGE_CENTS) throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: amount });

  let customer;
  if (order.userId && userId && order.userId === userId) {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    customer = user?.stripeCustomerId || undefined;
  }
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    customer,
    setup_future_usage: savePaymentMethod && customer ? "off_session" : undefined,
    automatic_payment_methods: noRedirects ? { enabled: true, allow_redirects: "never" } : { enabled: true },
    metadata: { orderId },
  });
  await prisma.order.update({ where: { id: orderId }, data: { stripePaymentIntentId: paymentIntent.id } });
  return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amountDueCents: amount };
}

/**
 * Retrieves a PaymentIntent from Stripe and checks it paid exactly `amount`
 * in USD and that `matchesMetadata(pi.metadata)`. Throws a 402 otherwise.
 */
export async function verifiedIntent(stripe, paymentIntentId, { amount, matchesMetadata }) {
  if (!paymentIntentId || typeof paymentIntentId !== "string") throw new OrderError("PAYMENT_REQUIRED", 402, "Payment required.");
  if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    throw new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified.");
  }
  const ours = Boolean(pi) && matchesMetadata(pi.metadata || {});
  const ok = ours && pi.status === "succeeded" && pi.amount === amount && (pi.currency || "usd").toLowerCase() === "usd";
  if (!ok) {
    const err = new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified.", { stripeStatus: pi?.status || null });
    // This order's own PaymentIntent took money but can't be applied (e.g. it
    // was for an older total): the caller refunds it rather than keep it silently.
    if (ours && pi.status === "succeeded") Object.defineProperty(err, "chargedIntent", { value: pi });
    throw err;
  }
  // Stripe keeps status "succeeded" after a refund. A refunded PaymentIntent
  // (for instance one refunded after a failed settle) must never pay for anything.
  if (await intentHasRefund(stripe, pi)) {
    throw new OrderError("PAYMENT_REFUNDED", 409, "This payment was refunded. Please pay again.");
  }
  return pi;
}

/**
 * True when the PaymentIntent has any refund: from an expanded latest_charge
 * (refunded / amount_refunded) when present, else stripe.refunds.list. If
 * Stripe can't answer, the payment is treated as unverified (402), never as
 * unrefunded.
 */
export async function intentHasRefund(stripe, pi) {
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (charge && (charge.refunded || (charge.amount_refunded || 0) > 0)) return true;
  try {
    const list = await stripe.refunds.list({ payment_intent: pi.id, limit: 1 });
    return Boolean(list?.data?.length);
  } catch {
    throw new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified.");
  }
}

/** A PaymentIntent that already has a PARTIAL refund (e.g. from the Stripe dashboard). */
export class PartialRefundError extends Error {
  constructor(refundedCents, amountCents) {
    super(`PaymentIntent already partially refunded (${refundedCents} of ${amountCents} cents)`);
    this.name = "PartialRefundError";
    this.code = "PARTIALLY_REFUNDED_ELSEWHERE";
    this.refundedCents = refundedCents;
    this.amountCents = amountCents;
  }
}

/**
 * The one card-refund path (owner's rule: FULL refunds only, never partial).
 * `stripe.refunds.create` gets the PaymentIntent and nothing else: no amount
 * field, so Stripe refunds the whole charge. Idempotent per PaymentIntent:
 * the create carries a per-PaymentIntent idempotency key shared by every
 * caller (the unapplied-payment path here and staff actions in
 * support/refund.js), so two paths can never refund the same charge twice.
 *
 * Existing refunds (not failed/canceled) are summed against the charged
 * amount: fully refunded -> { alreadyRefunded: true }, nothing new is
 * created; PARTIALLY refunded -> throws PartialRefundError and never tops it
 * up (a second refund would be a partial one). Throws on Stripe errors too;
 * the caller decides what that means.
 */
export async function refundFullPayment(stripe, pi, { idempotencyKey = null } = {}) {
  const id = typeof pi === "string" ? pi : pi?.id;
  if (!id) throw new Error("refundFullPayment: a PaymentIntent id is required");
  const existing = await stripe.refunds.list({ payment_intent: id, limit: 100 });
  const live = (existing?.data || []).filter((r) => r.status !== "failed" && r.status !== "canceled");
  if (live.length) {
    const known = pi && typeof pi === "object" ? pi.amount_received ?? pi.amount : null;
    let amountCents = Number.isInteger(known) ? known : null;
    if (amountCents === null) {
      const fresh = await stripe.paymentIntents.retrieve(id);
      amountCents = fresh.amount_received ?? fresh.amount;
    }
    const refundedCents = live.reduce((sum, r) => sum + (Number.isInteger(r.amount) ? r.amount : 0), 0);
    if (refundedCents >= amountCents) return { refundId: live[0].id, alreadyRefunded: true, refundedCents };
    throw new PartialRefundError(refundedCents, amountCents);
  }
  const refund = await stripe.refunds.create({ payment_intent: id }, { idempotencyKey: idempotencyKey || `order-refund-${id}` });
  return { refundId: refund.id, alreadyRefunded: false, refundedCents: refund.amount ?? null };
}

/**
 * A PaymentIntent that took the customer's money but could not be applied to
 * the order: FULL refund (owner's rule: never partial), a SupportCase for
 * staff, and an error log. Idempotent per PaymentIntent: when Stripe already
 * has a refund for it (a webhook retry, the return page), nothing new is
 * refunded or filed.
 */
export async function refundUnappliedPayment(prisma, stripe, { pi, orderId, userId = null, code }) {
  let refundId = null;
  let refunded = false;
  let partialElsewhere = null;
  try {
    const r = await refundFullPayment(stripe, pi);
    if (r.alreadyRefunded) return { refunded: true, refundId: r.refundId, alreadyRefunded: true };
    refundId = r.refundId;
    refunded = true;
  } catch (err) {
    if (err instanceof PartialRefundError) partialElsewhere = err;
    console.error(`[orders] refund FAILED for ${pi.id} (order ${orderId}):`, err?.message || err);
  }
  // A partial-prior-refund is not a generic failure: the card must NOT be
  // touched again in Stripe (a second refund would be a partial one, the
  // owner's rule forbids it), so staff are told to give store credit or
  // escalate instead of being pointed at a manual card refund.
  const summary = refunded
    ? `Payment ${pi.id} for order ${orderId} could not be applied (${code}); refunded in full, refund ${refundId}.`
    : partialElsewhere
      ? `Payment ${pi.id} for order ${orderId} could not be applied (${code}); it was already partly refunded outside the app (${partialElsewhere.refundedCents} of ${partialElsewhere.amountCents} cents). Do not refund it again in Stripe. Give the customer store credit, or escalate to the owner.`
      : `Payment ${pi.id} for order ${orderId} could not be applied (${code}); the refund attempt failed. Give the customer store credit, or escalate to the owner.`;
  try {
    await prisma.supportCase.create({ data: { type: "ORDER_ISSUE", orderId, userId, summary, amountCents: pi.amount ?? null } });
  } catch (err) {
    console.error(`[orders] could not file support case for ${pi.id}:`, err?.message || err);
  }
  console.error(`[orders] ${summary}`);
  return { refunded, refundId, alreadyRefunded: false };
}

/**
 * Any failure after a PaymentIntent was verified as succeeded (a refusal like
 * CREDIT_SHORT, or an unexpected database error) must not keep the money:
 * refund in full, file the case, and hand the ORIGINAL error back so the
 * caller still answers 409 or 5xx. The outcome rides on err.extra for an
 * OrderError, and on err.refunded / err.refundId otherwise.
 *
 * Before refunding, the order(s) are re-read: when every one is PAID with
 * this PaymentIntent, a concurrent settle (webhook vs return page) applied
 * the charge and this caller merely lost the race, so nothing is refunded
 * and err.appliedElsewhere is set. When the re-read itself fails, nothing is
 * refunded either (refunding an applied charge is the worse error): a
 * NEEDS_REVIEW support case is filed instead.
 */
async function refundOnFailure(prisma, stripe, err, { pi, orderId, orderIds = null, userId }) {
  if (!pi || !err) return err;
  const ids = orderIds || (orderId ? [orderId] : []);
  const code = err instanceof OrderError ? err.code : `SETTLE_FAILED: ${err.code || err.name || "Error"}`;
  const mark = (fields) => {
    if (err instanceof OrderError) err.extra = { ...err.extra, ...fields };
    else {
      try {
        Object.assign(err, fields);
      } catch {
        // a frozen error object
      }
    }
  };

  if (ids.length) {
    let rows;
    try {
      rows = [];
      for (const id of ids) rows.push(await prisma.order.findUnique({ where: { id } }));
    } catch (readErr) {
      const summary = `NEEDS_REVIEW: payment ${pi.id} for order ${ids.join(",")} may or may not be applied (${code}); the order could not be re-read (${readErr?.message || readErr}). Not refunded. Check the order and refund in Stripe if it is unpaid.`;
      try {
        await prisma.supportCase.create({ data: { type: "ORDER_ISSUE", orderId: ids.join(","), userId, summary, amountCents: pi.amount ?? null } });
      } catch (caseErr) {
        console.error(`[orders] could not file NEEDS_REVIEW case for ${pi.id}:`, caseErr?.message || caseErr);
      }
      console.error(`[orders] ${summary}`);
      mark({ refunded: false, needsReview: true });
      return err;
    }
    if (rows.every((o) => o && o.paymentStatus === "PAID" && o.stripePaymentId === pi.id)) {
      mark({ refunded: false });
      try {
        Object.defineProperty(err, "appliedElsewhere", { value: true });
      } catch {
        // frozen
      }
      return err;
    }
  }

  let r;
  try {
    r = await refundUnappliedPayment(prisma, stripe, { pi, orderId, userId, code });
  } catch (refundErr) {
    console.error(`[orders] refund handling failed for ${pi.id}:`, refundErr?.message || refundErr);
    return err;
  }
  if (err instanceof OrderError) {
    err.extra = { ...err.extra, refunded: r.refunded, ...(r.refundId ? { refundId: r.refundId } : {}) };
  } else {
    try {
      err.refunded = r.refunded;
      if (r.refundId) err.refundId = r.refundId;
    } catch {
      // a frozen error object: the refund and case happened regardless
    }
  }
  return err;
}

/** Card last4/brand for receipts; best effort, never fails a payment. */
async function cardDetails(stripe, pi) {
  try {
    if (!pi?.payment_method || !stripe?.paymentMethods) return {};
    const pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card || pm.card_present || pm.interac_present;
    return card ? { paymentMethodLast4: card.last4, paymentMethodBrand: card.brand } : {};
  } catch {
    return {};
  }
}

/** Calendar day number in America/Denver, for streaks. */
function denverDay(date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/**
 * The PAID transition and everything it spends, in one transaction `tx`.
 * The first write is the idempotency claim; if another confirmation already
 * won it this returns { alreadyPaid: true } having written nothing.
 */
async function settleInTx(tx, orderId, { expectedAmountDueCents, paymentIntentId = null, card = {}, now, batchIds = null }) {
  // The claim is pinned to the amount due that was verified against Stripe:
  // a re-quote that landed after verification makes it miss.
  const claim = await tx.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAID" }, amountDueCents: expectedAmountDueCents },
    data: { paymentStatus: "PAID", paidAt: now, ...(paymentIntentId ? { stripePaymentId: paymentIntentId } : {}), ...card },
  });
  if (claim.count !== 1) {
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (current?.paymentStatus === "PAID") return { alreadyPaid: true };
    throw new OrderError("QUOTE_CHANGED", 409, "Your order total changed. Review it and try again.");
  }

  const order = await tx.order.findUnique({ where: { id: orderId } });

  const isAddOn = Boolean(order.parentOrderId);
  if (order.status === "PENDING_PAYMENT" || order.status === "PAID") {
    // A paid add-on goes straight to the kitchen: the guest is already at the pod.
    const data = isAddOn ? { status: "PREPPING", queuedAt: now, podConfirmedAt: order.podConfirmedAt || now } : { status: "QUEUED", queuedAt: now };
    await tx.order.update({ where: { id: orderId }, data });
  }

  if (order.creditsAppliedCents > 0) {
    if (!order.userId) throw new OrderError("CREDIT_SHORT", 409, "Credits need a signed-in member.");
    try {
      await spendCreditInTx(tx, { userId: order.userId, amountCents: order.creditsAppliedCents, orderId, now });
    } catch (err) {
      if (err instanceof CreditShortError) {
        throw new OrderError("CREDIT_SHORT", 409, "Your credit balance changed. Review your order total.", { availableCents: err.availableCents });
      }
      throw err;
    }
  }

  if (order.rewardId) {
    try {
      await redeemReward(tx, { userId: order.userId, rewardId: order.rewardId, orderId, now });
    } catch {
      throw new OrderError("REWARD_UNAVAILABLE", 409, "That reward can't be used.");
    }
  }

  if (order.giftCardId && order.giftCardAppliedCents > 0) {
    const debit = await tx.giftCard.updateMany({
      where: { id: order.giftCardId, status: "ACTIVE", balanceCents: { gte: order.giftCardAppliedCents } },
      data: { balanceCents: { decrement: order.giftCardAppliedCents } },
    });
    if (debit.count !== 1) throw new OrderError("GIFT_CARD_SHORT", 409, "The gift card balance changed.");
    const card = await tx.giftCard.findUnique({ where: { id: order.giftCardId } });
    if (card && card.balanceCents === 0) await tx.giftCard.update({ where: { id: card.id }, data: { status: "EXHAUSTED" } });
  }

  if (order.mealGiftId && order.mealGiftAppliedCents > 0) {
    // Defense in depth: resolveMealGift already refuses this at quote time
    // (OWN_GIFT), but the gift is re-checked again here, at the moment it is
    // actually spent, in case the giver's own id ended up on the order some
    // other way.
    const taken = await tx.mealGift.updateMany({
      where: { id: order.mealGiftId, status: "PENDING", paidAt: { not: null }, expiresAt: { gt: now }, ...(order.userId ? { giverId: { not: order.userId } } : {}) },
      data: { status: "ACCEPTED", acceptedById: order.userId || null, orderId, acceptedAt: now },
    });
    if (taken.count !== 1) throw new OrderError("MEAL_GIFT_UNAVAILABLE", 409, "That meal gift is no longer available.");
  }

  if (order.promoCodeId && order.promoDiscountCents > 0) {
    // Final review I5: the limits are enforced HERE, at the moment the promo
    // is spent, not only at quote time. The conditional increment comes first:
    // its row lock on PromoCode serializes concurrent payments using this
    // promo, so the per-user count below (a fresh statement under READ
    // COMMITTED) sees every usage committed before it. Any miss throws
    // PROMO_EXHAUSTED, which rolls the whole settle back; markPaid then
    // refunds the card in full (refundOnFailure) and the order stays unpaid.
    const exhausted = () => new OrderError("PROMO_EXHAUSTED", 409, "That promo code has been used up. Review your order total.");
    if (!order.userId) throw exhausted();
    const promo = await tx.promoCode.findUnique({ where: { id: order.promoCodeId } });
    if (!promo) throw exhausted();
    const bumped = await tx.promoCode.updateMany({
      where: { id: promo.id, ...(promo.totalUsageLimit !== null && promo.totalUsageLimit !== undefined ? { currentUsageCount: { lt: promo.totalUsageLimit } } : {}) },
      data: { currentUsageCount: { increment: 1 } },
    });
    if (bumped.count !== 1) throw exhausted();
    const usedByMember = await tx.promoCodeUsage.count({ where: { promoCodeId: promo.id, userId: order.userId } });
    if (usedByMember >= (promo.perUserLimit ?? 1)) throw exhausted();
    await tx.promoCodeUsage.create({
      data: { promoCodeId: promo.id, userId: order.userId, guestId: order.guestId || null, orderId, discountCents: order.promoDiscountCents },
    });
  }

  // Hold the pod for 15 minutes from payment. Never an unconditional reserve
  // (Task D12 fix round 2): a pod still held for this order is kept, a free
  // one is re-claimed with claimSeat, and one another order took is replaced
  // by the next best pod. No free pod leaves the order PAID with no seat and a
  // staff note. An add-on is already at its pod and is left as it is.
  let podChange = null;
  if (order.seatId && !isAddOn) {
    podChange = await holdPodAtPay(tx, order, now, { batchIds: batchIds || [orderId], paymentIntentId: paymentIntentId || order.stripePaymentId || null });
    if (!podChange.noPod) await tx.order.update({ where: { id: orderId }, data: { podReservationExpiry: new Date(now.getTime() + POD_HOLD_MS) } });
    if (!podChange.changed && !podChange.noPod) podChange = null;
  }

  // Streak and lifetime stats. Tier progress and cashback are NOT touched:
  // they belong to onOrderCompleted at COMPLETED (membership/engine.js).
  if (order.userId) {
    const user = await tx.user.findUnique({ where: { id: order.userId } });
    if (user) {
      let streak = 1;
      if (user.lastOrderDate) {
        const gap = denverDay(now) - denverDay(new Date(user.lastOrderDate));
        if (gap === 0) streak = Math.max(1, user.currentStreak || 0);
        else if (gap === 1) streak = (user.currentStreak || 0) + 1;
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          lifetimeOrderCount: { increment: 1 },
          lifetimeSpentCents: { increment: spendBaseCents(order) },
          currentStreak: streak,
          longestStreak: Math.max(user.longestStreak || 0, streak),
          lastOrderDate: now,
        },
      });
    }
  }

  return { alreadyPaid: false, order: await tx.order.findUnique({ where: { id: orderId } }), podChange };
}

/** Side effects after a PAID commit. Each is isolated: the payment is already recorded. */
async function runPaidEffects(prisma, order, effects, now) {
  const run = async (name, fn) => {
    if (typeof fn !== "function") return undefined;
    try {
      return await fn();
    } catch (err) {
      console.error(`[orders] ${name} failed for order ${order.id}:`, err?.message || err);
      return undefined;
    }
  };
  await run("sendOrderConfirmation", () => effects.sendOrderConfirmation?.(order));
  await run("afterPaid", () => effects.afterPaid?.(order));
  if (order.mealGiftId && order.mealGiftAppliedCents > 0) {
    await run("mealGiftAccepted", () => effects.mealGiftAccepted?.({ mealGiftId: order.mealGiftId, order, appliedCents: order.mealGiftAppliedCents }));
  }
  // Completed before it was paid (e.g. staff finished it): pay the membership
  // side now that it's PAID. onOrderCompleted is idempotent on its own claim.
  if (order.status === "COMPLETED") {
    const complete = effects.onOrderCompleted || engineOnOrderCompleted;
    const membershipResult = await run("onOrderCompleted", () => complete(prisma, { orderId: order.id, now }));
    // Task F2 (fix round 1: corrected this comment - it's awaited, not
    // fire-and-forget, same as every other effect `run()` wraps in this
    // function; markPaid's own caller already waits on all of them,
    // including sendOrderConfirmation's Twilio call above). Sent after the
    // membership transaction has committed - never from inside it - and a
    // failure here is caught by `run()` and never fails the request.
    if (membershipResult?.upgradedTo) {
      await run("notifyTierUp", () => notifyTierUpIfNeeded(prisma, { userId: order.userId, upgradedTo: membershipResult.upgradedTo }));
    }
  }
}

function mapTxError(err) {
  if (err instanceof CreditShortError) return new OrderError("CREDIT_SHORT", 409, "Your credit balance changed. Review your order total.", { availableCents: err.availableCents });
  return err;
}

/**
 * Marks an order PAID, idempotently, after verifying the payment:
 *  - amountDueCents > 0: the PaymentIntent must be `succeeded`, for exactly
 *    order.amountDueCents USD, with metadata.orderId === orderId (else 402);
 *  - amountDueCents === 0: no PaymentIntent needed (the savings are re-checked
 *    and spent in the transaction).
 * Returns { alreadyPaid: true, order } when it was already PAID (a second
 * confirmation from the webhook or the return page), else { alreadyPaid: false, order }.
 * Refusals: 402 PAYMENT_REQUIRED/PAYMENT_NOT_VERIFIED, 409 CREDIT_SHORT,
 * GIFT_CARD_SHORT, MEAL_GIFT_UNAVAILABLE, REWARD_UNAVAILABLE, LEGACY_ORDER.
 */
export async function markPaid(prisma, stripe, { orderId, paymentIntentId = null, now = new Date() }, effects = config.effects) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new OrderError("ORDER_NOT_FOUND", 404, "Order not found");
  if (existing.paymentStatus === "PAID") {
    // A second, different PaymentIntent that also charged this order (two
    // tabs, a retry) is refunded rather than kept.
    if (paymentIntentId && stripe && paymentIntentId !== existing.stripePaymentId) {
      const extra = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
      if (extra && extra.status === "succeeded" && extra.metadata?.orderId === orderId) {
        const r = await refundUnappliedPayment(prisma, stripe, { pi: extra, orderId, userId: existing.userId, code: "DUPLICATE_PAYMENT" });
        return { alreadyPaid: true, order: existing, refunded: r.refunded };
      }
    }
    return { alreadyPaid: true, order: existing };
  }
  const order = loadPayableOrder(existing);

  let pi = null;
  if (order.amountDueCents > 0) {
    try {
      pi = await verifiedIntent(stripe, paymentIntentId, { amount: order.amountDueCents, matchesMetadata: (md) => md.orderId === orderId });
    } catch (err) {
      if (err.chargedIntent) throw await refundOnFailure(prisma, stripe, err, { pi: err.chargedIntent, orderId, userId: order.userId });
      throw err;
    }
  }
  const card = pi ? await cardDetails(stripe, pi) : {};

  let result;
  try {
    result = await prisma.$transaction((tx) => settleInTx(tx, orderId, { expectedAmountDueCents: order.amountDueCents, paymentIntentId: pi?.id || null, card, now }));
  } catch (err) {
    const failed = await refundOnFailure(prisma, stripe, mapTxError(err), { pi, orderId, userId: order.userId });
    // A concurrent confirmation applied this very charge: this caller just lost the race.
    if (failed.appliedElsewhere) return { alreadyPaid: true, order: await prisma.order.findUnique({ where: { id: orderId } }) };
    throw failed;
  }
  if (result.alreadyPaid) {
    const current = await prisma.order.findUnique({ where: { id: orderId } });
    // Final review I4: the order was paid by a DIFFERENT PaymentIntent that won
    // a concurrent confirm (two tabs, a Chappy pay card plus the web checkout).
    // This verified charge was never applied: refund it in FULL as a duplicate,
    // with a SupportCase (refundUnappliedPayment; idempotent per PaymentIntent).
    if (pi && current?.stripePaymentId !== pi.id) {
      const r = await refundUnappliedPayment(prisma, stripe, { pi, orderId, userId: order.userId, code: "DUPLICATE_PAYMENT" });
      return { alreadyPaid: true, order: current, refunded: r.refunded };
    }
    return { alreadyPaid: true, order: current };
  }

  await runPaidEffects(prisma, result.order, effects, now);
  return { alreadyPaid: false, order: result.order, ...(result.podChange ? { podChange: result.podChange } : {}) };
}

/**
 * Kiosk: one PaymentIntent (usually a Stripe Terminal card_present one)
 * paying several orders at the device's location. The PaymentIntent must be
 * `succeeded`, list exactly these orders in metadata.orderIds (comma
 * separated), and be for exactly the sum of their amountDueCents. All orders
 * are marked PAID in one transaction; a repeat is idempotent.
 */
export async function markPaidBatch(prisma, stripe, { orderIds, paymentIntentId = null, locationId, now = new Date() }, effects = config.effects) {
  const ids = Array.isArray(orderIds) ? [...new Set(orderIds.filter((id) => typeof id === "string" && id))] : [];
  if (ids.length === 0 || ids.length > MAX_KIOSK_BATCH) throw new OrderError("ORDERS_REQUIRED", 400, `Between 1 and ${MAX_KIOSK_BATCH} orderIds required.`);

  const orders = [];
  for (const id of ids) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", 404, "Order not found", { orderId: id });
    if (order.locationId !== locationId) throw new OrderError("ORDER_WRONG_LOCATION", 403, "That order belongs to another location.", { orderId: id });
    if (order.amountDueCents === null || order.amountDueCents === undefined) throw new OrderError("LEGACY_ORDER", 409, "This order was created before server pricing.", { orderId: id });
    orders.push(order);
  }
  if (orders.every((o) => o.paymentStatus === "PAID")) return { alreadyPaid: true, orders };

  const sum = orders.reduce((s, o) => s + o.amountDueCents, 0);
  let pi = null;
  if (sum > 0) {
    const want = [...ids].sort().join(",");
    try {
      pi = await verifiedIntent(stripe, paymentIntentId, {
        amount: sum,
        matchesMetadata: (md) => typeof md.orderIds === "string" && md.orderIds.split(",").map((s) => s.trim()).filter(Boolean).sort().join(",") === want,
      });
    } catch (err) {
      if (err.chargedIntent) throw await refundOnFailure(prisma, stripe, err, { pi: err.chargedIntent, orderId: ids.join(","), orderIds: ids, userId: null });
      throw err;
    }
  }
  return settleBatch(prisma, stripe, { ids, orders, pi, now, strict: false }, effects);
}

/**
 * The shared tail of a multi-order payment (kiosk batch, group host-pays):
 * settle every order in ONE transaction, each claim pinned to that order's
 * verified amount due; refund the charge in full if the settle fails; run
 * the PAID effects for each order this call actually paid.
 *
 * strict: every order must be settled by THIS payment. An order found PAID
 * by any other payment rolls the whole settle back (409 GROUP_CHANGED) and
 * the charge is refunded, so a payer is never charged for an order someone
 * else paid. The kiosk path keeps its original lenient behavior.
 */
async function settleBatch(prisma, stripe, { ids, orders, pi, now, strict }, effects) {
  const card = pi ? await cardDetails(stripe, pi) : {};

  let settled;
  try {
    settled = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const o of orders) {
        // Each claim is pinned to that order's verified amount due.
        const r = await settleInTx(tx, o.id, { expectedAmountDueCents: o.amountDueCents, paymentIntentId: pi?.id || null, card, now, batchIds: orders.map((x) => x.id) });
        if (strict && r.alreadyPaid) {
          const current = await tx.order.findUnique({ where: { id: o.id } });
          if (!pi || current?.stripePaymentId !== pi.id) {
            throw new OrderError("GROUP_CHANGED", 409, "Part of this group was already paid. Review the group and pay again.", { orderId: o.id });
          }
        }
        out.push(r);
      }
      return out;
    });
  } catch (err) {
    const failed = await refundOnFailure(prisma, stripe, mapTxError(err), { pi, orderId: ids.join(","), orderIds: ids, userId: null });
    if (failed.appliedElsewhere) {
      const fresh = [];
      for (const id of ids) fresh.push(await prisma.order.findUnique({ where: { id } }));
      return { alreadyPaid: true, orders: fresh };
    }
    throw failed;
  }

  const paid = [];
  for (const r of settled) {
    if (r.alreadyPaid) continue;
    paid.push(r.order);
    await runPaidEffects(prisma, r.order, effects, now);
  }
  const fresh = [];
  for (const id of ids) fresh.push(await prisma.order.findUnique({ where: { id } }));
  // Pods that moved at pay time (a lapsed hold another order took), so the kiosk shows the real pod.
  const podChanges = settled.map((r, i) => (r.podChange ? { orderId: orders[i].id, ...r.podChange } : null)).filter(Boolean);
  return { alreadyPaid: paid.length === 0, orders: fresh, ...(podChanges.length ? { podChanges } : {}) };
}

/**
 * Payment confirmation for callers that may still see legacy (pre-quote)
 * orders. Its last route caller, /chappy/confirm-payment, was removed in Task
 * B2 (customers pay through POST /orders/:id/confirm-payment, which calls
 * markPaid); it is kept for the legacy-order path. A server-priced order goes through
 * markPaid. A legacy order (null amountDueCents) is PAID only for a
 * succeeded PaymentIntent with metadata.orderId === orderId and
 * amount === order.totalCents, through a conditional claim.
 * Returns { alreadyPaid, order, legacy }.
 */
export async function confirmOrderPayment(prisma, stripe, { orderId, paymentIntentId = null, now = new Date() }, effects = config.effects) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("ORDER_NOT_FOUND", 404, "Order not found");
  if (order.amountDueCents !== null && order.amountDueCents !== undefined) {
    return { ...(await markPaid(prisma, stripe, { orderId, paymentIntentId, now }, effects)), legacy: false };
  }
  if (order.paymentStatus === "PAID") return { alreadyPaid: true, order, legacy: true };
  const pi = await verifiedIntent(stripe, paymentIntentId, { amount: order.totalCents, matchesMetadata: (md) => md.orderId === orderId });
  const claim = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "PAID", paidAt: now, stripePaymentId: pi.id },
  });
  return { alreadyPaid: claim.count !== 1, order: await prisma.order.findUnique({ where: { id: orderId } }), legacy: true };
}

/**
 * Kiosk PaymentIntent for unpaid orders at the device's location: the amount
 * is the sum of their amountDueCents, metadata.orderIds lists them.
 */
export async function createKioskPaymentIntent(prisma, stripe, { orderIds, locationId, terminal = true, now = new Date() }) {
  const ids = Array.isArray(orderIds) ? [...new Set(orderIds.filter((id) => typeof id === "string" && id))] : [];
  if (ids.length === 0 || ids.length > MAX_KIOSK_BATCH) throw new OrderError("ORDERS_REQUIRED", 400, `Between 1 and ${MAX_KIOSK_BATCH} orderIds required.`);
  let sum = 0;
  for (const id of ids) {
    const order = loadPayableOrder(await prisma.order.findUnique({ where: { id } }));
    if (order.locationId !== locationId) throw new OrderError("ORDER_WRONG_LOCATION", 403, "That order belongs to another location.", { orderId: id });
    await assertSavingsStillAvailable(prisma, order, now);
    sum += order.amountDueCents;
  }
  if (sum === 0) return { paymentIntentId: null, clientSecret: null, amountCents: 0 };
  if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
  if (sum < STRIPE_MIN_CHARGE_CENTS) throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: sum });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: sum,
    currency: "usd",
    ...(terminal ? { payment_method_types: ["card_present"], capture_method: "automatic" } : { automatic_payment_methods: { enabled: true } }),
    metadata: { orderIds: ids.join(","), locationId, source: "kiosk" },
  });
  return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, amountCents: sum, status: paymentIntent.status };
}

// ---------------------------------------------------------------------------
// Group orders: host pays for everyone (Task A7)
// ---------------------------------------------------------------------------

export const MAX_GROUP_ORDERS = 10;
const GROUP_PAYABLE_STATUSES = ["GATHERING", "CLOSED", "PAYING", "PARTIALLY_PAID"];

/** The group's orders the host would pay: unpaid, not cancelled, in id order. */
async function unpaidGroupOrders(prisma, groupOrderId) {
  const rows = await prisma.order.findMany({ where: { groupOrderId, paymentStatus: { not: "PAID" } } });
  return rows.filter((o) => o.status !== "CANCELLED").sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function parseOrderIds(value) {
  return typeof value === "string" ? [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))] : [];
}

const OPEN_INTENT_STATUSES = new Set(["requires_payment_method", "requires_confirmation", "requires_action"]);

/**
 * The host's single PaymentIntent for the whole group: the amount is the sum
 * of the unpaid member orders' amountDueCents (never a client amount), with
 * metadata { kind: "group", groupOrderId, orderIds }. Its id is kept on
 * GroupOrder.paymentIntentId, so a group has at most ONE live PaymentIntent:
 *  - the stored one SUCCEEDED (the host paid, then the page died before it
 *    confirmed): it is settled now through markGroupPaid, and no second
 *    PaymentIntent is ever made (returns alreadyPaid);
 *  - the stored one is still open and matches the current orders and sum:
 *    it is reused (same client secret);
 *  - the stored one is open but the group changed: it is cancelled and a new
 *    one is created (a cancel that fails because it just succeeded settles
 *    it instead);
 *  - a refunded or cancelled one is dead: a new one is created.
 * The group moves to PAYING (HOST_PAYS_ALL) only in the same conditional
 * write that stores a newly created PaymentIntent, after the Stripe minimum
 * check, so a failure anywhere before leaves the group as it was. A
 * concurrent call that stored its PaymentIntent first wins; the loser
 * cancels its own. Zero due: no PaymentIntent (clientSecret null).
 * The caller (group routes) has already checked it is the verified host.
 */
export async function createGroupPaymentIntent(prisma, stripe, { groupOrderId, now = new Date() }, effects = config.effects) {
  const group = await prisma.groupOrder.findUnique({ where: { id: groupOrderId } });
  if (!group) throw new OrderError("GROUP_NOT_FOUND", 404, "Group not found");
  if (group.status === "PAID") return { alreadyPaid: true, paymentIntentId: group.paymentIntentId || null, clientSecret: null, amountCents: 0, orderIds: [] };
  if (!GROUP_PAYABLE_STATUSES.includes(group.status)) throw new OrderError("GROUP_NOT_PAYABLE", 409, "This group can't be paid now.");

  // The group's existing PaymentIntent decides first.
  let existing = null;
  if (group.paymentIntentId) {
    if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
    try {
      existing = await stripe.paymentIntents.retrieve(group.paymentIntentId);
    } catch {
      throw new OrderError("PAYMENT_NOT_VERIFIED", 502, "The group payment could not be checked. Try again.");
    }
    if (existing.status === "succeeded" && !(await intentHasRefund(stripe, existing))) {
      const settled = await markGroupPaid(prisma, stripe, { groupOrderId, paymentIntentId: existing.id, now }, effects);
      return { alreadyPaid: true, settled: !settled.alreadyPaid, paymentIntentId: existing.id, clientSecret: null, amountCents: existing.amount, orderIds: parseOrderIds(existing.metadata?.orderIds) };
    }
    if (existing.status === "processing") throw new OrderError("PAYMENT_PROCESSING", 409, "The group payment is still processing.");
    if (!OPEN_INTENT_STATUSES.has(existing.status)) existing = null; // canceled, or refunded: dead
  }

  const orders = await unpaidGroupOrders(prisma, groupOrderId);
  if (orders.length === 0) throw new OrderError("NOTHING_TO_PAY", 409, "Every order in this group is already paid.");
  if (orders.length > MAX_GROUP_ORDERS) throw new OrderError("ORDERS_REQUIRED", 400, `At most ${MAX_GROUP_ORDERS} orders per group payment.`);
  let sum = 0;
  for (const o of orders) {
    const order = loadPayableOrder(o);
    await assertSavingsStillAvailable(prisma, order, now);
    sum += order.amountDueCents;
  }
  const orderIds = orders.map((o) => o.id);

  // Reuse the open PaymentIntent when it still covers exactly these orders.
  if (existing) {
    const sameOrders = parseOrderIds(existing.metadata?.orderIds).sort().join(",") === [...orderIds].sort().join(",");
    if (sameOrders && existing.amount === sum) {
      return { paymentIntentId: existing.id, clientSecret: existing.client_secret, amountCents: sum, orderIds, reused: true };
    }
  }

  if (sum > 0 && !stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");

  // The group changed: the old PaymentIntent must never be payable again.
  if (existing) {
    try {
      await stripe.paymentIntents.cancel(existing.id);
    } catch {
      const now2 = await stripe.paymentIntents.retrieve(existing.id).catch(() => null);
      if (now2?.status === "succeeded") {
        // It was paid while we were replacing it: settle it (markGroupPaid refunds if it no longer fits).
        const settled = await markGroupPaid(prisma, stripe, { groupOrderId, paymentIntentId: now2.id, now }, effects);
        return { alreadyPaid: true, settled: !settled.alreadyPaid, paymentIntentId: now2.id, clientSecret: null, amountCents: now2.amount, orderIds: parseOrderIds(now2.metadata?.orderIds) };
      }
      if (now2?.status !== "canceled") throw new OrderError("GROUP_CHANGED", 409, "The group payment changed. Try again.");
    }
  }

  // Under Stripe's minimum (fix round 2): the old PaymentIntent was cancelled
  // above, so undo the PAYING it stood for and refuse. No new PaymentIntent.
  if (sum > 0 && sum < STRIPE_MIN_CHARGE_CENTS) {
    if (existing) {
      await prisma.groupOrder.updateMany({ where: { id: groupOrderId, paymentIntentId: existing.id, status: "PAYING" }, data: { paymentIntentId: null, status: "CLOSED" } });
    }
    throw new OrderError("AMOUNT_BELOW_MINIMUM", 400, "Card payments must be at least $0.50.", { amountDueCents: sum });
  }

  if (sum === 0) {
    // Nothing to charge: no PaymentIntent; the host confirms the zero balance.
    await prisma.groupOrder.updateMany({ where: { id: groupOrderId, paymentIntentId: group.paymentIntentId ?? null }, data: { paymentIntentId: null, paymentMethod: "HOST_PAYS_ALL" } });
    return { paymentIntentId: null, clientSecret: null, amountCents: 0, orderIds };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: sum,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { kind: "group", groupOrderId, groupCode: group.code || "", orderIds: orderIds.join(",") },
  });

  // Store it and flip to PAYING in one conditional write: only if nobody
  // stored another PaymentIntent meanwhile and the group is still payable.
  const stored = await prisma.groupOrder.updateMany({
    where: { id: groupOrderId, paymentIntentId: group.paymentIntentId ?? null, status: { in: GROUP_PAYABLE_STATUSES } },
    data: { paymentIntentId: paymentIntent.id, status: "PAYING", paymentMethod: "HOST_PAYS_ALL", closedAt: group.closedAt || now },
  });
  if (stored.count !== 1) {
    await stripe.paymentIntents.cancel(paymentIntent.id).catch((err) => console.error(`[orders] could not cancel losing group PaymentIntent ${paymentIntent.id}:`, err?.message || err));
    const winner = await prisma.groupOrder.findUnique({ where: { id: groupOrderId } });
    if (winner?.paymentIntentId && winner.paymentIntentId !== group.paymentIntentId) {
      // Best effort: if Stripe can't be read, fall through to the intended 409.
      const pi = await stripe.paymentIntents.retrieve(winner.paymentIntentId).catch(() => null);
      if (pi && OPEN_INTENT_STATUSES.has(pi.status)) return { paymentIntentId: pi.id, clientSecret: pi.client_secret, amountCents: pi.amount, orderIds: parseOrderIds(pi.metadata?.orderIds), reused: true };
    }
    throw new OrderError("GROUP_CHANGED", 409, "The group payment changed. Try again.");
  }
  return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, amountCents: sum, orderIds };
}

/** Marks the group PAID once every non-cancelled order in it is PAID. */
async function finalizeGroupIfPaid(prisma, groupOrderId, now) {
  const rows = await prisma.order.findMany({ where: { groupOrderId } });
  const live = rows.filter((o) => o.status !== "CANCELLED");
  if (live.length > 0 && live.every((o) => o.paymentStatus === "PAID")) {
    await prisma.groupOrder.updateMany({ where: { id: groupOrderId, status: { not: "PAID" } }, data: { status: "PAID", finalizedAt: now } });
  }
  return prisma.groupOrder.findUnique({ where: { id: groupOrderId } });
}

/**
 * Host pays for the group, verified like the kiosk batch (markPaidBatch) but
 * bound to the group instead of a device's location:
 *  - the PaymentIntent must be `succeeded`, carry metadata.kind "group" and
 *    this groupOrderId, and be for exactly the sum of the amountDueCents of
 *    the orders it lists in metadata.orderIds;
 *  - every listed order must belong to this group and be unpaid;
 *  - all of them settle in ONE transaction (strict: an order someone else
 *    paid meanwhile rolls it back), and a charge that can't be applied is
 *    refunded in full with a support case.
 * No PaymentIntent is needed only when the unpaid orders owe nothing.
 * A repeat (webhook + return page) is idempotent.
 */
export async function markGroupPaid(prisma, stripe, { groupOrderId, paymentIntentId = null, now = new Date() }, effects = config.effects) {
  const group = await prisma.groupOrder.findUnique({ where: { id: groupOrderId } });
  if (!group) throw new OrderError("GROUP_NOT_FOUND", 404, "Group not found");

  if (!paymentIntentId) {
    const orders = await unpaidGroupOrders(prisma, groupOrderId);
    if (orders.length === 0) return { alreadyPaid: true, orders: [], group: await finalizeGroupIfPaid(prisma, groupOrderId, now) };
    for (const o of orders) loadPayableOrder(o);
    if (orders.reduce((s, o) => s + o.amountDueCents, 0) > 0) throw new OrderError("PAYMENT_REQUIRED", 402, "Payment required.");
    const ids = orders.map((o) => o.id);
    const result = await settleBatch(prisma, stripe, { ids, orders, pi: null, now, strict: true }, effects);
    return { ...result, group: await finalizeGroupIfPaid(prisma, groupOrderId, now) };
  }

  if (!stripe) throw new OrderError("PAYMENTS_UNAVAILABLE", 503, "Payments are not configured.");
  let pi0;
  try {
    pi0 = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    throw new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified.");
  }
  const md = pi0?.metadata || {};
  if (md.kind !== "group" || md.groupOrderId !== groupOrderId) throw new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified.");
  const ids = parseOrderIds(md.orderIds);
  // Our own group PaymentIntent took money: any refusal from here refunds it in full.
  const charged = pi0.status === "succeeded" ? pi0 : null;
  const refuse = async (err) => (charged ? refundOnFailure(prisma, stripe, err, { pi: charged, orderId: ids.join(","), orderIds: ids, userId: null }) : err);

  if (ids.length === 0 || ids.length > MAX_GROUP_ORDERS) throw await refuse(new OrderError("PAYMENT_NOT_VERIFIED", 402, "Payment could not be verified."));
  if (group.status === "CANCELLED") throw await refuse(new OrderError("GROUP_NOT_PAYABLE", 409, "This group was cancelled."));
  const orders = [];
  for (const id of ids) orders.push(await prisma.order.findUnique({ where: { id } }));

  // Already settled by this very payment (the other confirmation won).
  if (orders.every((o) => o && o.paymentStatus === "PAID" && o.stripePaymentId === paymentIntentId)) {
    return { alreadyPaid: true, orders, group: await finalizeGroupIfPaid(prisma, groupOrderId, now) };
  }
  for (const o of orders) {
    if (!o || o.groupOrderId !== groupOrderId || o.status === "CANCELLED" || o.amountDueCents === null || o.amountDueCents === undefined) {
      throw await refuse(new OrderError("GROUP_CHANGED", 409, "This group changed after payment started. Review the group and pay again.", { orderId: o?.id || null }));
    }
    if (o.paymentStatus === "PAID" && o.stripePaymentId !== paymentIntentId) {
      throw await refuse(new OrderError("GROUP_CHANGED", 409, "Part of this group was already paid. Review the group and pay again.", { orderId: o.id }));
    }
  }

  const sum = orders.reduce((s, o) => s + o.amountDueCents, 0);
  const want = [...ids].sort().join(",");
  let pi;
  try {
    pi = await verifiedIntent(stripe, paymentIntentId, {
      amount: sum,
      matchesMetadata: (m) => m.kind === "group" && m.groupOrderId === groupOrderId && parseOrderIds(m.orderIds).sort().join(",") === want,
    });
  } catch (err) {
    if (err.chargedIntent) throw await refundOnFailure(prisma, stripe, err, { pi: err.chargedIntent, orderId: ids.join(","), orderIds: ids, userId: null });
    throw err;
  }

  const result = await settleBatch(prisma, stripe, { ids, orders, pi, now, strict: true }, effects);
  return { ...result, group: await finalizeGroupIfPaid(prisma, groupOrderId, now) };
}
