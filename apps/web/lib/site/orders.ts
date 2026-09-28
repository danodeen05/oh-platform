/**
 * Typed client for the order API (Task A7): the one web entry point for
 * quoting, creating and paying dine-in orders.
 *
 * Payment status is the server's alone. An order becomes PAID only when the
 * API has verified a Stripe PaymentIntent itself (status, exact amount,
 * metadata) or a zero balance, so every "mark paid" in the web app goes
 * through `confirmPayment`, `kioskConfirmPayment` or `groupConfirmPayment`
 * with a PaymentIntent id; nothing ever sends `paymentStatus`.
 *
 * Isomorphic on purpose (no React, no "use client"): browser code passes the
 * Clerk-authenticated fetch from `useSiteApi()`, the Stripe webhook route
 * passes plain `fetch` with server headers.
 */

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export const ORDERS_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** A refusal from the API: `code` is the stable key to translate (CREDIT_SHORT, GROUP_CHANGED, ...). */
export type OrderApiError = {
  code: string | null;
  message: string | null;
  /** A charge the server could not apply was refunded in full. */
  refunded?: boolean;
  [key: string]: unknown;
};

/**
 * `ok` tells which half is meaningful: `data` on success, `error` on a
 * refusal (status 0 is a network failure). Both are always present so callers
 * read them without narrowing.
 */
export type OrderApiResult<T> = { ok: boolean; status: number; data: T; error: OrderApiError };

const NO_ERROR: OrderApiError = Object.freeze({ code: null, message: null }) as OrderApiError;

export type CallOptions = {
  fetcher?: Fetcher;
  baseUrl?: string;
  headers?: HeadersInit;
};

export type OrderLine = { menuItemId: string; quantity: number; selectedValue?: string | null };

export type Savings = {
  useCreditsCents?: number;
  promoCode?: string | null;
  giftCardCode?: string | null;
  mealGiftId?: string | null;
  rewardId?: string | null;
};

export type QuoteRequest = Savings & { locationId: string; items: OrderLine[] };

export type CreateOrderRequest = QuoteRequest & {
  tenantId?: string;
  guestId?: string | null;
  guestName?: string;
  estimatedArrival?: string | null;
  seat?: { label: string } | { best: true };
  seatId?: string;
  isDualPod?: boolean;
  partySize?: number;
  [key: string]: unknown;
};

export type Quote = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountDueCents: number;
  discounts: { promoCents: number; creditsCents: number; rewardCents: number; giftCardCents: number; mealGiftCents: number };
  warnings: string[];
  [key: string]: unknown;
};

export type Order = {
  id: string;
  orderNumber: string;
  totalCents: number;
  subtotalCents?: number | null;
  taxCents?: number | null;
  amountDueCents?: number | null;
  paymentStatus?: string;
  status?: string;
  [key: string]: unknown;
};

export type PaymentIntentResult = {
  clientSecret: string | null;
  paymentIntentId: string | null;
  amountDueCents: number;
  warnings: string[];
  totals: {
    subtotalCents: number;
    promoDiscountCents: number;
    rewardDiscountCents: number;
    taxCents: number;
    totalCents: number;
    creditsAppliedCents: number;
    mealGiftAppliedCents: number;
    giftCardAppliedCents: number;
    amountDueCents: number;
  };
};

/**
 * For a group, `alreadyPaid` means the group's stored PaymentIntent had already
 * succeeded (the host paid, then the page died) and the API settled it now:
 * nothing more to pay. `reused` means the same open PaymentIntent came back.
 */
export type BatchPaymentIntent = { paymentIntentId: string | null; clientSecret: string | null; amountCents: number; orderIds?: string[]; status?: string; alreadyPaid?: boolean; reused?: boolean };
export type BatchConfirmation = { alreadyPaid: boolean; orders: Order[]; group?: unknown };

const UPPER_SNAKE = /^[A-Z][A-Z0-9_]+$/;

/** Normalizes the API's `{ error, code?, message?, ...extra }` refusals. */
export function toOrderApiError(body: unknown): OrderApiError {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const error = typeof b.error === "string" ? b.error : null;
  const code = typeof b.code === "string" ? b.code : error && UPPER_SNAKE.test(error) ? error : null;
  const message = typeof b.message === "string" ? b.message : error && !UPPER_SNAKE.test(error) ? error : null;
  return { ...b, code, message, refunded: b.refunded === true ? true : b.refunded === false ? false : undefined };
}

async function call<T>(path: string, method: string, body: unknown, opts: CallOptions = {}): Promise<OrderApiResult<T>> {
  const fetcher = opts.fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const headers = new Headers(opts.headers);
  if (body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetcher(`${opts.baseUrl ?? ORDERS_API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, data: null as T, error: { code: "NETWORK_ERROR", message: null } };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, data: null as T, error: toOrderApiError(json) };
  return { ok: true, status: res.status, data: json as T, error: NO_ERROR };
}

const enc = encodeURIComponent;

/** POST /orders/quote: the server's price for a cart. Writes nothing. */
export function quote(body: QuoteRequest, opts?: CallOptions) {
  return call<Quote>("/orders/quote", "POST", body, opts);
}

/** POST /orders: an unpaid, server-priced order (the owner is the verified caller, never a body id). */
export function create(body: CreateOrderRequest, opts?: CallOptions) {
  return call<Order & { quote?: { discounts: Quote["discounts"]; warnings: string[] } }>("/orders", "POST", body, opts);
}

/** POST /orders/:id/payment-intent: a PaymentIntent for the order's amount due (optional savings re-quote it first). */
export function paymentIntent(orderId: string, savings: Savings & { savePaymentMethod?: boolean } = {}, opts?: CallOptions) {
  return call<PaymentIntentResult>(`/orders/${enc(orderId)}/payment-intent`, "POST", savings, opts);
}

/**
 * POST /orders/:id/confirm-payment: the server retrieves the PaymentIntent and
 * marks the order PAID once (idempotent with the webhook and the return
 * page). No id: only a server-verified zero balance can pay.
 */
export function confirmPayment(orderId: string, paymentIntentId?: string | null, opts?: CallOptions) {
  return call<Order & { alreadyPaid: boolean }>(`/orders/${enc(orderId)}/confirm-payment`, "POST", { paymentIntentId: paymentIntentId || undefined }, opts);
}

/** Kiosk (device key in opts.headers): one PaymentIntent for several orders at the device's location. */
export function kioskPaymentIntent(orderIds: string[], opts?: CallOptions & { terminal?: boolean }) {
  return call<BatchPaymentIntent>("/kiosk/orders/payment-intent", "POST", { orderIds, terminal: opts?.terminal }, opts);
}

/** Kiosk (device key in opts.headers): the server verifies the PaymentIntent (or a zero balance) for these orders. */
export function kioskConfirmPayment(orderIds: string[], paymentIntentId?: string | null, opts?: CallOptions) {
  return call<BatchConfirmation>("/kiosk/orders/confirm-payment", "POST", { orderIds, paymentIntentId: paymentIntentId || undefined }, opts);
}

/** Group host (signed in): ONE PaymentIntent for the sum of the group's unpaid orders. */
export function groupPaymentIntent(groupCode: string, opts?: CallOptions) {
  return call<BatchPaymentIntent>(`/group-orders/${enc(groupCode)}/payment-intent`, "POST", {}, opts);
}

/** Group host (or the webhook as a trusted service): verified settle of every order the PaymentIntent lists. */
export function groupConfirmPayment(groupCode: string, paymentIntentId?: string | null, opts?: CallOptions) {
  return call<BatchConfirmation>(`/group-orders/${enc(groupCode)}/confirm-payment`, "POST", { paymentIntentId: paymentIntentId || undefined }, opts);
}

/** A merch shop order as the API returns it (server-priced; payment status is the server's). */
export type ShopOrder = {
  id: string;
  orderNumber: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  creditsApplied: number;
  giftCardApplied: number;
  paymentStatus: string;
  [key: string]: unknown;
};

export type ShopOrderRequest = {
  items: { productId: string; quantity: number; variant?: string | null }[];
  fulfillmentType: "SHIPPING" | "IN_STORE_PICKUP";
  shipping?: Record<string, string | undefined> | null;
  locationId?: string | null;
  creditsToApply?: number;
  /** The gift card's code (the credential); a bare id is not accepted. */
  giftCardCode?: string | null;
};

/**
 * POST /shop/orders (Task D10a): an unpaid shop order priced by the server.
 * The owner is the verified member (Clerk fetch) or the guest session
 * (x-guest-session in opts.headers). A zero amount due comes back PAID.
 * Savings are recorded here and spent only when the order is paid, and the
 * same cart for the same owner reuses its unpaid order (fix round 1).
 */
export function createShopOrder(body: ShopOrderRequest, opts?: CallOptions) {
  return call<ShopOrder>("/shop/orders", "POST", body, opts);
}

/** A PaymentIntent for exactly what the shop order owes; the client never sends an amount. */
export function shopPaymentIntent(shopOrderId: string, opts?: CallOptions) {
  return call<{ clientSecret: string | null; id: string | null; paymentIntentId: string | null; amountCents: number }>("/create-payment-intent", "POST", { kind: "shop_order", shopOrderId }, opts);
}

/** POST /shop/orders/:id/confirm-payment: the API verifies the PaymentIntent and marks the order PAID once. */
export function shopConfirmPayment(shopOrderId: string, paymentIntentId: string, opts?: CallOptions) {
  return call<{ alreadyPaid: boolean; id: string; orderNumber: string; paymentStatus: string; totalCents: number }>(`/shop/orders/${enc(shopOrderId)}/confirm-payment`, "POST", { paymentIntentId }, opts);
}

/** POST /gift-cards/confirm-payment (webhook only, service key): the card for a succeeded purchase PaymentIntent. */
export function giftCardConfirmPayment(paymentIntentId: string, opts?: CallOptions) {
  return call<{ success: boolean; giftCardId: string; created: boolean }>("/gift-cards/confirm-payment", "POST", { paymentIntentId }, opts);
}

/**
 * A confirm call that may succeed if repeated: a network failure or a 5xx
 * from the API. The Stripe webhook answers 5xx for these so Stripe retries.
 * "Already paid" (200) and verified refusals (4xx) are final, and so is a
 * charge the API already refunded.
 */
export function isRetryableFailure(res: { ok: boolean; status: number; error?: OrderApiError | null }): boolean {
  if (res.ok) return false;
  if (res.error?.refunded === true) return false;
  return res.status === 0 || res.status >= 500;
}

/**
 * What the Stripe webhook does with a succeeded PaymentIntent for a food
 * order, a host-paid group, a shop order ({kind:"shop", shopOrderId}) or a
 * gift card ({type:"gift_card"}): ask the API to verify and settle it.
 * `retry: true` means the webhook must answer 5xx so Stripe delivers again.
 * The group confirm needs no key: it is verified against Stripe; a service
 * key, when configured, is sent anyway. The shop and gift card confirms
 * need it (ADMIN_API_KEY): a missing key, or a 401/403 from those confirms,
 * is `retry: true` so a charged payment is never silently dropped.
 */
export async function confirmFromWebhook(
  paymentIntent: { id: string; metadata?: Record<string, string> | null },
  opts: CallOptions & { serviceKey?: string | null } = {},
): Promise<{ handled: "group" | "order" | "shop" | "gift_card" | null; ok: boolean; retry: boolean; status: number; code: string | null }> {
  const md = paymentIntent.metadata || {};
  const call = { ...opts, headers: opts.serviceKey ? { ...(opts.headers as Record<string, string>), "x-admin-api-key": opts.serviceKey } : opts.headers };
  let handled: "group" | "order" | "shop" | "gift_card" | null = null;
  let res: OrderApiResult<unknown> | null = null;
  if (md.kind === "group" && md.groupCode) {
    handled = "group";
    res = await groupConfirmPayment(md.groupCode, paymentIntent.id, call);
  } else if ((md.kind === "shop" && md.shopOrderId) || md.type === "gift_card") {
    // Service-only confirms (fix round 1): without ADMIN_API_KEY they can only
    // fail, so ask Stripe to retry instead of dropping a charged payment.
    handled = md.kind === "shop" ? "shop" : "gift_card";
    if (!opts.serviceKey) return { handled, ok: false, retry: true, status: 0, code: "ADMIN_API_KEY_MISSING" };
    res = handled === "shop" ? await shopConfirmPayment(md.shopOrderId, paymentIntent.id, call) : await giftCardConfirmPayment(paymentIntent.id, call);
    // 401/403 here means the key doesn't match the API's, not a verified refusal.
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      return { handled, ok: false, retry: true, status: res.status, code: res.error?.code ?? "SERVICE_KEY_REJECTED" };
    }
  } else if (md.orderId && md.source !== "shop" && md.source !== "gift_card") {
    handled = "order";
    res = await confirmPayment(md.orderId, paymentIntent.id, call);
  }
  if (!res) return { handled, ok: true, retry: false, status: 0, code: null };
  return { handled, ok: res.ok, retry: isRetryableFailure(res), status: res.status, code: res.error?.code ?? null };
}

/**
 * Group routes identify a guest by the server-issued guest session token (the
 * guest cookie), never by a guest id the page sends. Members are identified by
 * the Clerk session that `useSiteApi()` attaches.
 */
export function groupIdentityHeaders(guest: { sessionToken?: string | null } | null | undefined): Record<string, string> {
  return guest?.sessionToken ? { "x-guest-session": guest.sessionToken } : {};
}

/** "pi_123_secret_abc" -> "pi_123" (Stripe's redirect return carries the client secret). */
export function paymentIntentIdFromClientSecret(clientSecret: string | null | undefined): string | null {
  if (!clientSecret) return null;
  const id = clientSecret.split("_secret_")[0];
  return id && id.startsWith("pi_") ? id : null;
}
