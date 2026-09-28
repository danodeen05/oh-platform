/**
 * The Stripe redirect return path for Chappy's pay card (Task E2, hardened
 * in fix round 1).
 *
 * Chat PaymentIntents are created with `allow_redirects: "never"` (card,
 * Apple Pay, Google Pay; 3D Secure finishes inside the page), so a redirect
 * should not happen. This path is the safety net for one Stripe forces
 * anyway: it comes back to the SAME page (its path carries the locale) with
 * `?chappyPay=<orderId>` plus Stripe's `payment_intent` and
 * `redirect_status`. ChappyProvider reads that on load, strips it from the
 * address bar and reopens Chappy; the widget then asks the SERVER.
 *
 * The URL is never trusted: a link anyone can craft carries it. So
 *  - no pay card is ever built from it (a new pay card only comes from a
 *    fresh `checkout` tool result), and the client secret in it is ignored;
 *  - the order must be the signed-in caller's own (GET /orders/:id with the
 *    Clerk token returns the full order, with its owner, only to the owner);
 *  - PAID only through POST /orders/:id/confirm-payment, which verifies the
 *    PaymentIntent with Stripe (succeeded, amount, metadata.orderId).
 *
 * No React, so ChappyProvider (first paint) stays small.
 */
export const CHAPPY_PAY_PARAM = "chappyPay";
const STRIPE_PARAMS = ["payment_intent", "payment_intent_client_secret", "redirect_status"] as const;
const LOCALES = ["en", "es", "zh-TW", "zh-CN"];

export type ChappyPayReturn = {
  orderId: string;
  paymentIntentId: string | null;
  /** Stripe's redirect_status: "succeeded", "processing", "failed", or null. */
  status: string | null;
};

/** Where Stripe sends the customer back: this page, in this locale, flagged for Chappy. */
export function chappyReturnUrl(orderId: string, locale: string, href: string): string {
  const u = new URL(href);
  u.hash = "";
  u.searchParams.delete(CHAPPY_PAY_PARAM);
  for (const k of STRIPE_PARAMS) u.searchParams.delete(k);
  // Every customer page lives under /{locale}/; make sure the return does too.
  const first = u.pathname.split("/")[1] || "";
  if (!LOCALES.includes(first)) u.pathname = `/${locale}${u.pathname === "/" ? "" : u.pathname}`;
  u.searchParams.set(CHAPPY_PAY_PARAM, orderId);
  return u.toString();
}

/** The pay-card return in this URL, if any, and the URL without it (for history.replaceState). The client secret is dropped, never read. */
export function readChappyReturn(href: string): { ret: ChappyPayReturn; cleanUrl: string } | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const orderId = u.searchParams.get(CHAPPY_PAY_PARAM);
  if (!orderId) return null;
  const pi = u.searchParams.get("payment_intent");
  const ret: ChappyPayReturn = {
    orderId,
    paymentIntentId: pi && /^pi_[A-Za-z0-9]+$/.test(pi) ? pi : null,
    status: u.searchParams.get("redirect_status"),
  };
  u.searchParams.delete(CHAPPY_PAY_PARAM);
  for (const k of STRIPE_PARAMS) u.searchParams.delete(k);
  return { ret, cleanUrl: `${u.pathname}${u.search}${u.hash}` };
}

type ApiResult<T> = { ok: boolean; status: number; data: T; error: { code: string | null; refunded?: boolean } };
type OrderLike = { id: string; userId?: string | null; paymentStatus?: string; [k: string]: unknown };

export type PayReturnOutcome = { kind: "paid"; order: OrderLike } | { kind: "notPaid" } | { kind: "refunded" } | { kind: "processing" };

/**
 * What the return means, decided by the server for this caller.
 * `getOrder` is GET /orders/:id with the member's token; `confirm` is
 * confirmPayment (lib/site/orders.ts), with the same token.
 */
export async function resolvePayReturn(
  ret: ChappyPayReturn,
  deps: { getOrder: (orderId: string) => Promise<ApiResult<OrderLike | null>>; confirm: (orderId: string, paymentIntentId: string) => Promise<ApiResult<OrderLike>> },
): Promise<PayReturnOutcome> {
  if (!ret.paymentIntentId || ret.status === "failed") return { kind: "notPaid" };
  const own = await deps.getOrder(ret.orderId).catch(() => null);
  // Only the owner gets the full order (with userId); anyone else gets the safe view or a refusal.
  if (!own || !own.ok || !own.data || !own.data.userId) return { kind: "notPaid" };
  if (own.data.paymentStatus === "PAID") return { kind: "paid", order: own.data };
  const res = await deps.confirm(ret.orderId, ret.paymentIntentId);
  if (res.ok && res.data) return { kind: "paid", order: res.data };
  if (res.error?.refunded) return { kind: "refunded" };
  return ret.status === "processing" ? { kind: "processing" } : { kind: "notPaid" };
}
