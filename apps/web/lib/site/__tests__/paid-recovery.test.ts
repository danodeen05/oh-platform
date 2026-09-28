import { describe, expect, it, vi } from "vitest";
import {
  clearPending,
  finishWithRetry,
  isPendingGift,
  isPendingShop,
  loadPending,
  PENDING_GIFT_KEY,
  PENDING_SHOP_KEY,
  retryable,
  savePending,
  shopFinishOutcome,
  type FinishResult,
} from "../paid-recovery";
import { RECREATE_CODES } from "../store";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

const ok: FinishResult = { ok: true, status: 200 };
const netDown: FinishResult = { ok: false, status: 0, error: { code: "NETWORK_ERROR" } };
const server500: FinishResult = { ok: false, status: 500, error: { code: null } };
const busy429: FinishResult = { ok: false, status: 429, error: { code: null } };

describe("after Stripe succeeds (Task D10 fix round 1)", () => {
  it("a confirm that fails on the network, then succeeds, is retried with the same PaymentIntent", async () => {
    const confirm = vi.fn<(pi: string) => Promise<FinishResult>>().mockResolvedValueOnce(netDown).mockResolvedValueOnce(ok);
    const sleep = vi.fn(async (_ms: number) => undefined);
    const res = await finishWithRetry(() => confirm("pi_123"), { sleep });
    expect(res.ok).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls.every(([pi]) => pi === "pi_123")).toBe(true);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("stops after 3 tries on 5xx/429 (then the page offers Retry), and a manual retry with the same id can succeed", async () => {
    const confirm = vi.fn<(pi: string) => Promise<FinishResult>>().mockResolvedValueOnce(server500).mockResolvedValueOnce(busy429).mockResolvedValueOnce(server500).mockResolvedValueOnce(ok);
    const sleep = vi.fn(async (_ms: number) => undefined);
    const first = await finishWithRetry(() => confirm("pi_abc"), { sleep });
    expect(first.ok).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
    expect(shopFinishOutcome(first, RECREATE_CODES)).toBe("stuck");
    // The Retry button: the same PaymentIntent again.
    const second = await finishWithRetry(() => confirm("pi_abc"), { sleep });
    expect(second.ok).toBe(true);
    expect(confirm).toHaveBeenLastCalledWith("pi_abc");
  });

  it("does not retry a verified refusal", async () => {
    const refused: FinishResult = { ok: false, status: 409, error: { code: "CREDIT_SHORT", refunded: true } };
    const confirm = vi.fn(async () => refused);
    const res = await finishWithRetry(confirm, { sleep: async () => undefined });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(retryable(res)).toBe(false);
    expect(shopFinishOutcome(res, RECREATE_CODES)).toBe("reprice");
  });

  it("maps outcomes: never back to Pay unless the charge was returned or the order changed", () => {
    expect(shopFinishOutcome(ok, RECREATE_CODES)).toBe("done");
    expect(shopFinishOutcome({ ok: false, status: 409, error: { code: "ORDER_CHANGED", needsReview: true, refunded: false } }, RECREATE_CODES)).toBe("review");
    // A shortfall whose refund failed: retry the confirm (it re-attempts the refund), don't re-price.
    expect(shopFinishOutcome({ ok: false, status: 409, error: { code: "CREDIT_SHORT", refunded: false } }, RECREATE_CODES)).toBe("stuck");
    expect(shopFinishOutcome({ ok: false, status: 409, error: { code: "ORDER_CHANGED" } }, RECREATE_CODES)).toBe("reprice");
    expect(shopFinishOutcome({ ok: false, status: 402, error: { code: "PAYMENT_NOT_VERIFIED" } }, RECREATE_CODES)).toBe("stuck");
    expect(shopFinishOutcome(netDown, RECREATE_CODES)).toBe("stuck");
  });

  it("a reload resumes the confirm with the stored PaymentIntent instead of a new payment", async () => {
    const storage = memoryStorage();
    savePending(storage, PENDING_SHOP_KEY, { orderId: "ord_1", orderNumber: "SO-ABC123", paymentIntentId: "pi_reload" });
    // ... the page reloads ...
    const pending = loadPending(storage, PENDING_SHOP_KEY, isPendingShop);
    expect(pending).toEqual({ orderId: "ord_1", orderNumber: "SO-ABC123", paymentIntentId: "pi_reload" });
    const confirm = vi.fn(async (_orderId: string, _pi: string) => ok);
    const res = await finishWithRetry(() => confirm(pending!.orderId, pending!.paymentIntentId), { sleep: async () => undefined });
    expect(res.ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith("ord_1", "pi_reload");
    clearPending(storage, PENDING_SHOP_KEY);
    expect(loadPending(storage, PENDING_SHOP_KEY, isPendingShop)).toBeNull();
  });

  it("stores the gift draft with its PaymentIntent, and ignores junk", () => {
    const storage = memoryStorage();
    savePending(storage, PENDING_GIFT_KEY, { paymentIntentId: "pi_gift", draft: { dollars: 35, design: "gold", name: "Lucía", email: "l@example.com", message: "" } });
    expect(loadPending(storage, PENDING_GIFT_KEY, isPendingGift)?.paymentIntentId).toBe("pi_gift");
    storage.setItem(PENDING_GIFT_KEY, "{not json");
    expect(loadPending(storage, PENDING_GIFT_KEY, isPendingGift)).toBeNull();
    storage.setItem(PENDING_SHOP_KEY, JSON.stringify({ orderId: "x", orderNumber: "y", paymentIntentId: "not-a-pi" }));
    expect(loadPending(storage, PENDING_SHOP_KEY, isPendingShop)).toBeNull();
  });
});
