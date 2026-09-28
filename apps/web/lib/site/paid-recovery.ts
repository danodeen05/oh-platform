/**
 * After Stripe says a payment succeeded (Task D10 fix round 1).
 *
 * Once a PaymentIntent has succeeded, the page must never offer to pay
 * again: it only finishes (POST /shop/orders/:id/confirm-payment, or
 * POST /gift-cards for a gift card). Both calls are idempotent on the
 * server, so they are retried with the SAME PaymentIntent id:
 *  - automatically, a few times with backoff, on a network error, a 5xx or
 *    a 429;
 *  - then by hand (a Retry button), with a support fallback.
 * The pending PaymentIntent is kept in sessionStorage, so a reload resumes
 * the finish instead of starting a new payment.
 *
 * Pure (no React); the pages and the unit tests share it.
 */

export type FinishResult = { ok: boolean; status: number; error?: { code?: string | null; refunded?: boolean; needsReview?: boolean } | null };

/** A failure worth trying again with the same PaymentIntent: the server may never have seen it, or was busy. */
export function retryable(r: Pick<FinishResult, "ok" | "status">): boolean {
  return !r.ok && (r.status === 0 || r.status === 429 || r.status >= 500);
}

export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

/**
 * Calls `attempt` up to `tries` times while it fails retryably, waiting
 * `delays[i]` between tries. Returns the last result.
 */
export async function finishWithRetry<T extends FinishResult>(
  attempt: () => Promise<T>,
  opts: { tries?: number; delays?: readonly number[]; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const tries = opts.tries ?? 3;
  const delays = opts.delays ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let result = await attempt();
  for (let i = 1; i < tries && retryable(result); i++) {
    await sleep(delays[Math.min(i - 1, delays.length - 1)]);
    result = await attempt();
  }
  return result;
}

// ------------------------------------------------------------ pending payments

export const PENDING_SHOP_KEY = "oh-store-paid";
export const PENDING_GIFT_KEY = "oh-gift-paid";

export type PendingShop = { orderId: string; orderNumber: string; paymentIntentId: string };
export type PendingGift<D> = { paymentIntentId: string; draft: D };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function savePending(storage: Storage | null | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the finish still runs in this page */
  }
}

export function loadPending<T>(storage: Storage | null | undefined, key: string, valid: (v: unknown) => v is T): T | null {
  try {
    const raw = storage?.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return valid(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearPending(storage: Storage | null | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isPendingShop(v: unknown): v is PendingShop {
  const o = v as PendingShop | null;
  return Boolean(o && typeof o.orderId === "string" && typeof o.orderNumber === "string" && typeof o.paymentIntentId === "string" && o.paymentIntentId.startsWith("pi_"));
}

export function isPendingGift<D>(v: unknown): v is PendingGift<D> {
  const o = v as PendingGift<D> | null;
  return Boolean(o && typeof o.paymentIntentId === "string" && o.paymentIntentId.startsWith("pi_") && o.draft && typeof o.draft === "object");
}

/**
 * What a page does with a finish result:
 *  - "done": finished;
 *  - "reprice": the server refunded the charge (or the order changed): drop the order, review again;
 *  - "review": a person is checking this payment; do not pay again;
 *  - "stuck": the payment went through but finishing failed; offer Retry (same PaymentIntent) and support.
 */
export type FinishOutcome = "done" | "reprice" | "review" | "stuck";

export function shopFinishOutcome(r: FinishResult, recreateCodes: readonly string[]): FinishOutcome {
  if (r.ok) return "done";
  if (r.error?.needsReview) return "review";
  if (r.error?.refunded === true) return "reprice";
  if (r.error?.code && recreateCodes.includes(r.error.code) && r.error.refunded !== false) return "reprice";
  return "stuck";
}

// ------------------------------------------------------------ food orders and groups (final review C1, I1)

/**
 * The order pay step (PayStep) and the group host's pay form (GroupPayForm)
 * follow the same rule: once Stripe says a PaymentIntent succeeded, it is
 * saved here (per order or group), the confirm is retried with that SAME id,
 * and no new PaymentIntent is fetched while it is pending. Only the server
 * saying the charge was refunded, or that the order changed (with the charge
 * refunded), clears it and allows a fresh PaymentIntent.
 */
export const PENDING_ORDER_KEY = "oh-order-paid";
export const PENDING_GROUP_KEY = "oh-group-paid";

export type PendingOrder = { orderId: string; paymentIntentId: string };
export type PendingGroup = { groupCode: string; paymentIntentId: string };

const isPi = (v: unknown) => typeof v === "string" && v.startsWith("pi_");

export function isPendingOrder(v: unknown): v is PendingOrder {
  const o = v as PendingOrder | null;
  return Boolean(o && typeof o.orderId === "string" && o.orderId && isPi(o.paymentIntentId));
}

export function isPendingGroup(v: unknown): v is PendingGroup {
  const o = v as PendingGroup | null;
  return Boolean(o && typeof o.groupCode === "string" && o.groupCode && isPi(o.paymentIntentId));
}

/** The pending payment of THIS order (a pending one for another order is left alone). */
export function pendingOrderFor(storage: Storage | null | undefined, orderId: string | null | undefined): PendingOrder | null {
  const p = loadPending(storage, PENDING_ORDER_KEY, isPendingOrder);
  return p && orderId && p.orderId === orderId ? p : null;
}

/** The pending payment of THIS group (codes compare case-insensitively). */
export function pendingGroupFor(storage: Storage | null | undefined, groupCode: string | null | undefined): PendingGroup | null {
  const p = loadPending(storage, PENDING_GROUP_KEY, isPendingGroup);
  return p && groupCode && p.groupCode.toUpperCase() === groupCode.toUpperCase() ? p : null;
}

/** Order confirm codes that mean "this charge can't pay for this order" (with the charge refunded): pay again. */
export const ORDER_RECREATE_CODES = [
  "PAYMENT_REFUNDED",
  "QUOTE_CHANGED",
  "QUOTE_MISMATCH",
  "CREDIT_SHORT",
  "GIFT_CARD_SHORT",
  "MEAL_GIFT_UNAVAILABLE",
  "REWARD_UNAVAILABLE",
  "PROMO_EXHAUSTED",
  "ORDER_CANCELLED",
  "ORDER_NOT_FOUND",
  "LEGACY_ORDER",
] as const;

/** Group confirm codes that mean the same for the host's batch PaymentIntent. */
export const GROUP_RECREATE_CODES = [
  "PAYMENT_REFUNDED",
  "GROUP_CHANGED",
  "QUOTE_CHANGED",
  "CREDIT_SHORT",
  "GIFT_CARD_SHORT",
  "MEAL_GIFT_UNAVAILABLE",
  "REWARD_UNAVAILABLE",
] as const;

/**
 * Saves `pending` under `key`, then confirms it with the same PaymentIntent
 * (retried with backoff on network errors, 5xx and 429). "done" and
 * "reprice" clear it; "stuck" and "review" keep it, so a reload resumes the
 * confirm and never pays again.
 */
export async function settlePaid<R extends FinishResult>(
  storage: Storage | null | undefined,
  key: string,
  pending: unknown,
  attempt: () => Promise<R>,
  recreateCodes: readonly string[],
  opts?: Parameters<typeof finishWithRetry>[1],
): Promise<{ outcome: FinishOutcome; result: R }> {
  savePending(storage, key, pending);
  const result = await finishWithRetry(attempt, opts);
  const outcome = shopFinishOutcome(result, recreateCodes);
  if (outcome === "done" || outcome === "reprice") clearPending(storage, key);
  return { outcome, result };
}
