/**
 * Single source of truth for promo discount math.
 *
 * Used by the promo validate endpoint, catering booking creation, and the
 * catering payment re-price endpoint so the displayed and charged amounts
 * always agree.
 *
 * @param {object} p
 * @param {"PERCENTAGE"|"FIXED_AMOUNT"|"FIXED_PER_BOWL"|"FREE_SHIPPING"} p.discountType
 * @param {number} p.discountValue   percent (0-100) for PERCENTAGE; cents otherwise
 * @param {number|null} [p.maxDiscountCents] cap for PERCENTAGE
 * @param {number} p.subtotalCents
 * @param {number} [p.quantity=1]    number of bowls (for FIXED_PER_BOWL)
 * @returns {number} discount in cents, clamped to [0, subtotalCents]
 */
export function computeDiscountCents({
  discountType,
  discountValue,
  maxDiscountCents = null,
  subtotalCents,
  quantity = 1,
}) {
  let discount = 0;

  switch (discountType) {
    case "PERCENTAGE":
      discount = Math.round((subtotalCents * discountValue) / 100);
      if (maxDiscountCents && discount > maxDiscountCents) discount = maxDiscountCents;
      break;
    case "FIXED_AMOUNT":
      discount = discountValue;
      break;
    case "FIXED_PER_BOWL":
      discount = discountValue * Math.max(0, Math.floor(quantity || 0));
      break;
    // FREE_SHIPPING and anything else: no line-item discount here
    default:
      discount = 0;
  }

  // Never negative, never more than the subtotal.
  return Math.min(Math.max(0, discount), subtotalCents);
}
