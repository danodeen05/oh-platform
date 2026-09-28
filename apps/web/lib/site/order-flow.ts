/**
 * Small pure helpers for the order flow (Task D5): the translated message
 * for an API refusal, money and time display, Stripe's locale.
 * (Route matching is in ./order-routes.ts and the pod's walk in ./pod-walk.ts,
 * so the shell and the pay page don't pull in what they don't use.)
 */

/** Every refusal code the flow translates (orderFlow.errors.<CODE>); anything else is GENERIC. */
export const ORDER_ERROR_CODES = [
  "DINE_IN_DISABLED",
  "ORDERING_CLOSED",
  "ARRIVAL_INVALID",
  "POD_UNAVAILABLE",
  "ITEM_UNAVAILABLE",
  "ITEM_NOT_RELEASED",
  "INVALID_QUANTITY",
  "ITEMS_REQUIRED",
  "LOCATION_NOT_FOUND",
  "REWARD_UNAVAILABLE",
  "REWARD_NOT_APPLICABLE",
  "CREDIT_SHORT",
  "GIFT_CARD_SHORT",
  "MEAL_GIFT_UNAVAILABLE",
  "QUOTE_CHANGED",
  "QUOTE_MISMATCH",
  "ALREADY_PAID",
  "ORDER_CANCELLED",
  "LEGACY_ORDER",
  "ORDER_NOT_FOUND",
  "PAYMENTS_UNAVAILABLE",
  "AMOUNT_BELOW_MINIMUM",
  "PAYMENT_REQUIRED",
  "PAYMENT_NOT_VERIFIED",
  "PAYMENT_REFUNDED",
  "PAYMENT_NOT_APPLIED",
  // Final backend review (I5): the promo's use limit ran out between quote and pay.
  "PROMO_EXHAUSTED",
  "FORBIDDEN",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "GENERIC",
] as const;
export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number];

/** Quote warnings the savings step explains (orderFlow.warnings.<CODE>). */
export const QUOTE_WARNINGS = ["PROMO_INVALID", "PROMO_REQUIRES_SIGN_IN", "GIFT_CARD_INVALID", "CREDITS_REQUIRE_SIGN_IN", "MEAL_GIFT_UNAVAILABLE"] as const;

export function orderErrorCode(code: string | null | undefined, status?: number): OrderErrorCode {
  if (code && (ORDER_ERROR_CODES as readonly string[]).includes(code)) return code as OrderErrorCode;
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  return "GENERIC";
}

/** "$17.49" in every locale (narrow symbol: zh-TW would otherwise show "US$"). */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }).format(cents / 100);
}

/** Stripe Elements' locale for a site locale. */
export function stripeLocale(locale: string): "en" | "es" | "zh-TW" | "zh" {
  if (locale === "zh-TW") return "zh-TW";
  if (locale.startsWith("zh")) return "zh";
  if (locale === "es") return "es";
  return "en";
}

/** The clock time of an arrival option, in the location's time zone ("12:45 PM", "12:45"). */
export function arrivalClock(minutes: number, locale: string, timeZone: string, now: Date = new Date()): string {
  const at = new Date(now.getTime() + minutes * 60_000);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(at);
}
