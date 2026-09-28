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
