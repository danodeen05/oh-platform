/**
 * The Stripe redirect return path for Chappy's pay card (Task E2).
 *
 * Card payments with 3D Secure finish inside the page (Stripe's own
 * challenge frame, `redirect: "if_required"`). A payment method that must
 * leave the page comes back to the SAME page (its path carries the locale)
 * with `?chappyPay=<orderId>` plus Stripe's own `payment_intent`,
 * `payment_intent_client_secret` and `redirect_status`. ChappyProvider
 * reads that on load, strips it from the address bar, and reopens Chappy,
 * which asks the API to verify the payment (POST /orders/:id/confirm-payment)
 * and posts the result into the conversation.
 *
 * Pure: no React, so ChappyProvider (first paint) stays small.
 */
export const CHAPPY_PAY_PARAM = "chappyPay";
const STRIPE_PARAMS = ["payment_intent", "payment_intent_client_secret", "redirect_status"] as const;
const LOCALES = ["en", "es", "zh-TW", "zh-CN"];

export type ChappyPayReturn = {
  orderId: string;
  paymentIntentId: string | null;
  clientSecret: string | null;
  /** Stripe's redirect_status: "succeeded", "processing", "failed", or null. */
  status: string | null;
};

/** Where Stripe sends the customer back: this page, in this locale, flagged for Chappy. */
export function chappyReturnUrl(orderId: string, locale: string, href: string): string {
  const u = new URL(href);
  u.hash = "";
  for (const k of STRIPE_PARAMS) u.searchParams.delete(k);
  // Every customer page lives under /{locale}/; make sure the return does too.
  const first = u.pathname.split("/")[1] || "";
  if (!LOCALES.includes(first)) u.pathname = `/${locale}${u.pathname === "/" ? "" : u.pathname}`;
  u.searchParams.set(CHAPPY_PAY_PARAM, orderId);
  return u.toString();
}

/** The pay-card return in this URL, if any, and the URL without it (for history.replaceState). */
export function readChappyReturn(href: string): { ret: ChappyPayReturn; cleanUrl: string } | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const orderId = u.searchParams.get(CHAPPY_PAY_PARAM);
  if (!orderId) return null;
  const paymentIntentId = u.searchParams.get("payment_intent");
  const ret: ChappyPayReturn = {
    orderId,
    paymentIntentId: paymentIntentId && paymentIntentId.startsWith("pi_") ? paymentIntentId : null,
    clientSecret: u.searchParams.get("payment_intent_client_secret"),
    status: u.searchParams.get("redirect_status"),
  };
  u.searchParams.delete(CHAPPY_PAY_PARAM);
  for (const k of STRIPE_PARAMS) u.searchParams.delete(k);
  return { ret, cleanUrl: `${u.pathname}${u.search}${u.hash}` };
}
