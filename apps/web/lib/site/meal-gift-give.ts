/**
 * Giving a meal to a stranger (Task D9): /challenges/meal-for-stranger.
 *
 * The API owns every rule; this file only sequences the calls:
 *  1. POST /create-payment-intent { kind: "meal_gift", amountCents, locationId }
 *     (signed-in giver; the server binds giver and location in the metadata).
 *  2. Stripe confirms the payment on the page (or after a 3DS redirect).
 *  3. POST /meal-gifts { locationId, amountCents, messageFromGiver, paymentIntentId }.
 *     The gift exists only once the server verifies that PaymentIntent
 *     (succeeded, the exact amount, this giver and location). No store
 *     credit and no promo codes on meal gifts (D10a).
 *
 * The gift's details are saved in sessionStorage under the PaymentIntent id
 * before Stripe confirms, so a redirect return (or a failed step 3 after a
 * successful charge) records the gift with the same PaymentIntent instead of
 * charging again. A 409 PAYMENT_ALREADY_USED means that PaymentIntent already
 * funded a gift: that is success, not an error.
 *
 * Task D9 fix round 1: the note also rides on the PaymentIntent (the server
 * puts giver, location and note in its metadata), so the Stripe webhook
 * records the gift even when the tab is closed before step 3
 * (POST /meal-gifts/confirm-payment). The saved gift keeps the client secret
 * too, so a reload resumes: a succeeded PaymentIntent is recorded, an
 * unfinished one shows its payment form again (never a second PaymentIntent).
 */
import type { SiteFetch } from "./api";

export const MEAL_GIFT_MIN_CENTS = 1599;
export const MEAL_GIFT_MAX_CENTS = 3500;
/** The amounts offered as chips: a classic bowl, a bowl with a side, and more. */
export const MEAL_GIFT_AMOUNTS = [1599, 1999, 2500, 3500] as const;
export const MEAL_GIFT_DEFAULT_CENTS = 1999;
export const MEAL_GIFT_MESSAGE_MAX = 200;
export const PENDING_GIFT_KEY = "ohMealGiftPending";
/**
 * The giver's reward the first time one of their gifts is taken. Mirrors
 * MEAL_GIFT_GIVER_REWARD_CENTS in packages/api/src/orders/tenders.js (the
 * API has no public read for it); change both together.
 */
export const MEAL_GIFT_GIVER_REWARD_CENTS = 500;

export type PendingGift = { paymentIntentId: string; locationId: string; amountCents: number; message: string | null; clientSecret?: string | null };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Error codes the page translates (giveMeal.errors.<code>). */
export const GIFT_ERROR_CODES = [
  "SIGN_IN_REQUIRED",
  "AMOUNT_OUT_OF_RANGE",
  "LOCATION_REQUIRED",
  "PAYMENT_NOT_VERIFIED",
  "PAYMENT_REFUNDED",
  "PAYMENTS_UNAVAILABLE",
  "RATE_LIMITED",
  "NETWORK_ERROR",
  "GENERIC",
] as const;
export type GiftErrorCode = (typeof GIFT_ERROR_CODES)[number];

export function giftErrorCode(code: unknown, status?: number): GiftErrorCode {
  if (typeof code === "string" && (GIFT_ERROR_CODES as readonly string[]).includes(code)) return code as GiftErrorCode;
  if (status === 401) return "SIGN_IN_REQUIRED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "PAYMENTS_UNAVAILABLE";
  return "GENERIC";
}

export function validGiftAmount(cents: number): boolean {
  return Number.isInteger(cents) && cents >= MEAL_GIFT_MIN_CENTS && cents <= MEAL_GIFT_MAX_CENTS;
}

/** "pi_123_secret_abc" -> "pi_123". */
export function paymentIntentIdFromSecret(secret: string | null | undefined): string | null {
  const m = typeof secret === "string" ? secret.match(/^(pi_[A-Za-z0-9]+)_secret_/) : null;
  return m ? m[1] : null;
}

export function savePendingGift(storage: StorageLike | null | undefined, gift: PendingGift): void {
  try {
    storage?.setItem(PENDING_GIFT_KEY, JSON.stringify(gift));
  } catch {
    /* storage blocked: a redirect return then can't record the gift, and the page says so */
  }
}

/** The saved gift for this PaymentIntent (any saved gift when `paymentIntentId` is null), or null. */
export function readPendingGift(storage: StorageLike | null | undefined, paymentIntentId: string | null): PendingGift | null {
  try {
    const raw = storage?.getItem(PENDING_GIFT_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as PendingGift;
    if (typeof g?.paymentIntentId !== "string" || !g.paymentIntentId.startsWith("pi_")) return null;
    if (paymentIntentId !== null && g.paymentIntentId !== paymentIntentId) return null;
    if (typeof g.locationId !== "string" || !validGiftAmount(g.amountCents)) return null;
    const secret = typeof g.clientSecret === "string" && paymentIntentIdFromSecret(g.clientSecret) === g.paymentIntentId ? g.clientSecret : null;
    return { paymentIntentId: g.paymentIntentId, locationId: g.locationId, amountCents: g.amountCents, message: typeof g.message === "string" ? g.message : null, clientSecret: secret };
  } catch {
    return null;
  }
}

/** What a reload does with a saved gift, from its PaymentIntent's status (Stripe.js retrievePaymentIntent). */
export type ResumeAction = "record" | "pay" | "wait" | "drop";
export function resumeAction(status: string | null | undefined): ResumeAction {
  if (status === "succeeded") return "record";
  if (status === "processing") return "wait";
  if (status === "requires_payment_method" || status === "requires_confirmation" || status === "requires_action") return "pay";
  return "drop";
}

export function clearPendingGift(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(PENDING_GIFT_KEY);
  } catch {
    /* ignore */
  }
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json().catch(() => null)) as Record<string, unknown> | null) || {};
}

export type StartResult = { ok: true; clientSecret: string; paymentIntentId: string } | { ok: false; code: GiftErrorCode; retry: boolean };

export async function startMealGiftPayment(api: SiteFetch, apiBase: string, input: { locationId: string; amountCents: number; message?: string | null }): Promise<StartResult> {
  let res: Response;
  try {
    res = await api(`${apiBase}/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
      body: JSON.stringify({ kind: "meal_gift", amountCents: input.amountCents, locationId: input.locationId, ...(input.message ? { messageFromGiver: input.message } : {}) }),
    });
  } catch {
    return { ok: false, code: "NETWORK_ERROR", retry: true };
  }
  const b = await body(res);
  if (!res.ok) {
    const code = giftErrorCode(b.error, res.status);
    return { ok: false, code, retry: res.status >= 500 || res.status === 429 };
  }
  const clientSecret = typeof b.clientSecret === "string" ? b.clientSecret : "";
  const paymentIntentId = (typeof b.paymentIntentId === "string" && b.paymentIntentId) || paymentIntentIdFromSecret(clientSecret);
  if (!clientSecret || !paymentIntentId) return { ok: false, code: "GENERIC", retry: true };
  return { ok: true, clientSecret, paymentIntentId };
}

export type RecordResult =
  | { ok: true; already: boolean; giftId: string | null }
  | { ok: false; code: GiftErrorCode; retry: boolean; refunded: boolean };

export async function recordMealGift(api: SiteFetch, apiBase: string, gift: PendingGift): Promise<RecordResult> {
  let res: Response;
  try {
    res = await api(`${apiBase}/meal-gifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
      body: JSON.stringify({ locationId: gift.locationId, amountCents: gift.amountCents, messageFromGiver: gift.message || null, paymentIntentId: gift.paymentIntentId }),
    });
  } catch {
    return { ok: false, code: "NETWORK_ERROR", retry: true, refunded: false };
  }
  const b = await body(res);
  if (res.ok) return { ok: true, already: false, giftId: typeof b.id === "string" ? b.id : null };
  // This PaymentIntent already funded a gift (a retry after a lost response).
  if (res.status === 409 && b.code === "PAYMENT_ALREADY_USED") return { ok: true, already: true, giftId: null };
  const code = giftErrorCode(b.code ?? b.error, res.status);
  return { ok: false, code, retry: res.status >= 500 || res.status === 429 || code === "NETWORK_ERROR", refunded: b.refunded === true };
}
