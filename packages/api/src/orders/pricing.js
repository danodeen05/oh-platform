/**
 * Order pricing: pure functions only (no I/O).
 *
 * The one place the web order flow, the kiosk and Chappy get a price from.
 * `quoteOrder` in ./service.js resolves the savings (promo, reward, credits,
 * meal gift, gift card) from the database and hands the amounts to
 * `computeTotals` here, so every surface prices an order the same way.
 *
 * Money order (ruling Q2, Task A6):
 *   subtotal
 *   - reward   (one unit of a qualifying line, before tax)
 *   - promo    (on the subtotal after the reward, before tax)
 *   = taxable base, taxed at the location's rate (Math.round)
 *   = total
 *   - credits  (member credit lots, at most MAX_CREDITS_PER_ORDER_CENTS)
 *   - meal gift
 *   - gift card
 *   = amount due (what a PaymentIntent may charge)
 * Credits, meal gifts and gift cards are tenders, like cash: they never lower tax.
 */
import { computeDiscountCents } from "../promos/discount.js";

/** Most member credit one food order may use. */
export const MAX_CREDITS_PER_ORDER_CENTS = 500;

/** Largest quantity accepted for one line. */
export const MAX_LINE_QUANTITY = 20;

/**
 * Price of `quantity` of `menuItem`. Moved verbatim from the old
 * calculateItemPrice in POST /orders (index.js): included servings are free,
 * the first paid serving costs basePriceCents and each extra one
 * additionalPriceCents.
 */
export function itemPriceCents(menuItem, quantity) {
  // If quantity is within included amount, price is 0
  if (quantity <= menuItem.includedQuantity) {
    return 0;
  }

  // If there's an included quantity, only charge for extras
  if (menuItem.includedQuantity > 0) {
    const extraQuantity = quantity - menuItem.includedQuantity;
    return menuItem.basePriceCents + menuItem.additionalPriceCents * (extraQuantity - 1);
  }

  // Standard pricing: base + additional for each extra
  return menuItem.basePriceCents + menuItem.additionalPriceCents * (quantity - 1);
}

export class PricingError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.name = "PricingError";
    this.code = code;
    Object.assign(this, extra);
  }
}

/**
 * Prices each requested line against the given menu rows.
 * Throws PricingError ITEM_UNAVAILABLE for an id not in `menuItems`, and
 * INVALID_QUANTITY for anything but an integer 0..MAX_LINE_QUANTITY.
 */
export function priceLines(menuItems, items) {
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  return items.map((item) => {
    const menuItem = byId.get(item.menuItemId);
    if (!menuItem) throw new PricingError("ITEM_UNAVAILABLE", { menuItemId: item.menuItemId });
    const quantity = item.quantity;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) {
      throw new PricingError("INVALID_QUANTITY", { menuItemId: item.menuItemId });
    }
    return {
      menuItemId: item.menuItemId,
      quantity,
      priceCents: itemPriceCents(menuItem, quantity),
      // Display label for slider items (e.g. "Light", "Medium")
      selectedValue: item.selectedValue || null,
    };
  });
}

/** Tax on a base amount at a fractional rate (0.0945 for 9.45%). */
export function taxCents(subtotalCents, taxRate) {
  return Math.round(subtotalCents * (Number(taxRate) || 0));
}

export function isMainItem(menuItem) {
  return menuItem?.categoryType === "MAIN" || (typeof menuItem?.category === "string" && menuItem.category.startsWith("main"));
}

export function isAddonItem(menuItem) {
  return menuItem?.categoryType === "ADDON" || (typeof menuItem?.category === "string" && menuItem.category.startsWith("add-on"));
}

/** Bowls in the order (for FIXED_PER_BOWL promos): paid MAIN lines' quantity. */
export function bowlCount(lines, menuById) {
  return lines.reduce((n, line) => {
    const mi = menuById.get(line.menuItemId);
    return isMainItem(mi) && (mi.basePriceCents || 0) > 0 ? n + line.quantity : n;
  }, 0);
}

/**
 * What a reward takes off (ruling Q4): one unit of the highest-priced
 * qualifying line, at that item's base price and never more than the line
 * costs. FREE_BOWL qualifies MAIN lines, PREMIUM_ADDON qualifies ADDON lines.
 * Returns null when no line qualifies (REWARD_NOT_APPLICABLE).
 */
export function rewardDiscountCents(lines, menuById, rewardType) {
  const qualifies = rewardType === "FREE_BOWL" ? isMainItem : rewardType === "PREMIUM_ADDON" ? isAddonItem : null;
  if (!qualifies) return null;
  let best = null;
  for (const line of lines) {
    const mi = menuById.get(line.menuItemId);
    if (!qualifies(mi) || line.priceCents <= 0 || (mi.basePriceCents || 0) <= 0) continue;
    if (!best || mi.basePriceCents > best.base) best = { base: mi.basePriceCents, line };
  }
  return best ? Math.min(best.base, best.line.priceCents) : null;
}

/**
 * Totals for a priced order. Every input amount is a non-negative integer of
 * cents already validated by the caller (quoteOrder); this only orders and
 * clamps them.
 *
 * @param {object} p
 * @param {number} p.subtotalCents
 * @param {number} [p.rewardCents]            from rewardDiscountCents
 * @param {object|null} [p.promo]             {discountType, discountValue, maxDiscountCents}
 * @param {number} [p.bowls]                  for FIXED_PER_BOWL
 * @param {number} p.taxRate
 * @param {number} [p.creditsRequestedCents]  what the member asked to use
 * @param {number} [p.creditsAvailableCents]  unexpired lots right now
 * @param {number} [p.mealGiftCents]          the gift's full value
 * @param {number} [p.giftCardBalanceCents]
 */
export function computeTotals({
  subtotalCents,
  rewardCents = 0,
  promo = null,
  bowls = 1,
  taxRate = 0,
  creditsRequestedCents = 0,
  creditsAvailableCents = 0,
  mealGiftCents = 0,
  giftCardBalanceCents = 0,
}) {
  const reward = Math.min(Math.max(0, rewardCents), subtotalCents);
  const afterReward = subtotalCents - reward;
  const promoCents = promo
    ? computeDiscountCents({
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        maxDiscountCents: promo.maxDiscountCents ?? null,
        subtotalCents: afterReward,
        quantity: bowls,
      })
    : 0;
  const taxableCents = afterReward - promoCents;
  const tax = taxCents(taxableCents, taxRate);
  const totalCents = taxableCents + tax;

  let remaining = totalCents;
  const creditsCents = Math.max(0, Math.min(creditsRequestedCents, creditsAvailableCents, MAX_CREDITS_PER_ORDER_CENTS, remaining));
  remaining -= creditsCents;
  const mealGiftApplied = Math.max(0, Math.min(mealGiftCents, remaining));
  remaining -= mealGiftApplied;
  const giftCardCents = Math.max(0, Math.min(giftCardBalanceCents, remaining));
  remaining -= giftCardCents;

  return {
    subtotalCents,
    discounts: { promoCents, creditsCents, rewardCents: reward, giftCardCents, mealGiftCents: mealGiftApplied },
    taxableCents,
    taxCents: tax,
    totalCents,
    amountDueCents: remaining,
  };
}

/**
 * What an order is worth for cashback, lifetime spend and challenge progress
 * (controller ruling, Task A6 fix round 1): pre-tax and after promo and
 * reward, including whatever tender (credits, gift card, meal gift) paid for
 * it. Legacy orders without a stored subtotal fall back to totalCents.
 */
export function spendBaseCents(order) {
  if (order?.subtotalCents === null || order?.subtotalCents === undefined) return Math.max(0, order?.totalCents || 0);
  return Math.max(0, order.subtotalCents - (order.promoDiscountCents || 0) - (order.rewardDiscountCents || 0));
}
