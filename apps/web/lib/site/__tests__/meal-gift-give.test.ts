import { describe, expect, it } from "vitest";
import {
  clearPendingGift,
  giftErrorCode,
  paymentIntentIdFromSecret,
  PENDING_GIFT_KEY,
  readPendingGift,
  resumeAction,
  recordMealGift,
  savePendingGift,
  startMealGiftPayment,
  validGiftAmount,
} from "../meal-gift-give";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

function api(status: number, body: unknown, calls: { url: string; body: unknown }[] = []) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(body), { status });
  };
}

const GIFT = { paymentIntentId: "pi_123", locationId: "L1", amountCents: 1999, message: "Enjoy" };

describe("meal gift giving helpers (Task D9)", () => {
  it("validates the amount range the API enforces", () => {
    expect(validGiftAmount(1599)).toBe(true);
    expect(validGiftAmount(3500)).toBe(true);
    expect(validGiftAmount(1598)).toBe(false);
    expect(validGiftAmount(3501)).toBe(false);
    expect(validGiftAmount(19.99)).toBe(false);
  });

  it("reads the PaymentIntent id from a client secret", () => {
    expect(paymentIntentIdFromSecret("pi_3Abc123_secret_xyz")).toBe("pi_3Abc123");
    expect(paymentIntentIdFromSecret("seti_1_secret_x")).toBeNull();
    expect(paymentIntentIdFromSecret(null)).toBeNull();
  });

  it("keeps the pending gift only for the same PaymentIntent", () => {
    const s = memory();
    savePendingGift(s, GIFT);
    expect(readPendingGift(s, "pi_123")).toEqual({ ...GIFT, clientSecret: null });
    expect(readPendingGift(s, "pi_other")).toBeNull();
    s.m.set(PENDING_GIFT_KEY, JSON.stringify({ ...GIFT, amountCents: 99999 }));
    expect(readPendingGift(s, "pi_123")).toBeNull();
    s.m.set(PENDING_GIFT_KEY, "{not json");
    expect(readPendingGift(s, "pi_123")).toBeNull();
    clearPendingGift(s);
    expect(s.m.has(PENDING_GIFT_KEY)).toBe(false);
  });

  it("fix round 1: a reload finds any saved gift, keeps only its own client secret, and resumes by status", () => {
    const s = memory();
    savePendingGift(s, { ...GIFT, clientSecret: "pi_123_secret_abc" });
    expect(readPendingGift(s, null)).toEqual({ ...GIFT, clientSecret: "pi_123_secret_abc" });
    savePendingGift(s, { ...GIFT, clientSecret: "pi_other_secret_abc" });
    expect(readPendingGift(s, null)?.clientSecret).toBeNull();
    expect(resumeAction("succeeded")).toBe("record");
    expect(resumeAction("processing")).toBe("wait");
    expect(resumeAction("requires_payment_method")).toBe("pay");
    expect(resumeAction("requires_action")).toBe("pay");
    expect(resumeAction("canceled")).toBe("drop");
    expect(resumeAction(undefined)).toBe("drop");
  });

  it("fix round 1: the note rides on the PaymentIntent so the webhook can record the gift", async () => {
    const calls: { url: string; body: unknown }[] = [];
    await startMealGiftPayment(api(200, { clientSecret: "pi_9_secret_z", paymentIntentId: "pi_9" }, calls), "http://api", { locationId: "L1", amountCents: 2500, message: "Enjoy" });
    expect(calls[0].body).toEqual({ kind: "meal_gift", amountCents: 2500, locationId: "L1", messageFromGiver: "Enjoy" });
  });

  it("starts a meal_gift PaymentIntent with only the amount and location (no credit, no promo)", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const r = await startMealGiftPayment(api(200, { clientSecret: "pi_9_secret_z", paymentIntentId: "pi_9" }, calls), "http://api", { locationId: "L1", amountCents: 2500 });
    expect(r).toEqual({ ok: true, clientSecret: "pi_9_secret_z", paymentIntentId: "pi_9" });
    expect(calls).toEqual([{ url: "http://api/create-payment-intent", body: { kind: "meal_gift", amountCents: 2500, locationId: "L1" } }]);
  });

  it("maps a signed-out start to SIGN_IN_REQUIRED", async () => {
    expect(await startMealGiftPayment(api(401, { error: "Sign in required" }), "http://api", { locationId: "L1", amountCents: 2500 })).toEqual({ ok: false, code: "SIGN_IN_REQUIRED", retry: false });
  });

  it("records the gift with the PaymentIntent the server verifies", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const r = await recordMealGift(api(200, { id: "mg1" }, calls), "http://api", GIFT);
    expect(r).toEqual({ ok: true, already: false, giftId: "mg1" });
    expect(calls[0]).toEqual({ url: "http://api/meal-gifts", body: { locationId: "L1", amountCents: 1999, messageFromGiver: "Enjoy", paymentIntentId: "pi_123" } });
  });

  it("treats PAYMENT_ALREADY_USED as done (a retry after a lost response)", async () => {
    expect(await recordMealGift(api(409, { code: "PAYMENT_ALREADY_USED", error: "used" }), "http://api", GIFT)).toEqual({ ok: true, already: true, giftId: null });
  });

  it("a refused payment is not retried and says whether it was refunded", async () => {
    expect(await recordMealGift(api(402, { code: "PAYMENT_NOT_VERIFIED", refunded: true }), "http://api", GIFT)).toEqual({ ok: false, code: "PAYMENT_NOT_VERIFIED", retry: false, refunded: true });
  });

  it("a server or network failure is retryable with the same PaymentIntent", async () => {
    expect(await recordMealGift(api(500, {}), "http://api", GIFT)).toMatchObject({ ok: false, retry: true });
    const down = async () => Promise.reject(new TypeError("fetch failed"));
    expect(await recordMealGift(down, "http://api", GIFT)).toMatchObject({ ok: false, code: "NETWORK_ERROR", retry: true });
  });

  it("unknown codes fall back by status", () => {
    expect(giftErrorCode("WAT", 429)).toBe("RATE_LIMITED");
    expect(giftErrorCode(undefined, 503)).toBe("PAYMENTS_UNAVAILABLE");
    expect(giftErrorCode("AMOUNT_OUT_OF_RANGE", 400)).toBe("AMOUNT_OUT_OF_RANGE");
    expect(giftErrorCode(undefined, 400)).toBe("GENERIC");
  });
});
