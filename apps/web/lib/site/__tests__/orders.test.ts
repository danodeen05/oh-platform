import { describe, expect, test } from "vitest";
import {
  quote,
  create,
  paymentIntent,
  confirmPayment,
  kioskConfirmPayment,
  groupPaymentIntent,
  groupConfirmPayment,
  paymentIntentIdFromClientSecret,
  toOrderApiError,
  groupIdentityHeaders,
  isRetryableFailure,
  confirmFromWebhook,
  type Fetcher,
} from "../orders";

type Call = { url: string; init: RequestInit };

function fakeFetch(status = 200, body: unknown = {}) {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { calls, fetcher };
}

const bodyOf = (c: Call) => JSON.parse(String(c.init.body));

describe("lib/site/orders", () => {
  test("confirmPayment posts only the PaymentIntent id to /orders/:id/confirm-payment; never paymentStatus", async () => {
    const { calls, fetcher } = fakeFetch(200, { id: "o1", paymentStatus: "PAID", alreadyPaid: false });
    const res = await confirmPayment("o1", "pi_123", { fetcher, baseUrl: "http://api" });
    expect(res.ok).toBe(true);
    expect(calls[0].url).toBe("http://api/orders/o1/confirm-payment");
    expect(calls[0].init.method).toBe("POST");
    expect(bodyOf(calls[0])).toEqual({ paymentIntentId: "pi_123" });
    expect(String(calls[0].init.body)).not.toMatch(/paymentStatus/);
    expect(new Headers(calls[0].init.headers).get("Content-Type")).toBe("application/json");
  });

  test("a zero balance confirms with no PaymentIntent id", async () => {
    const { calls, fetcher } = fakeFetch();
    await confirmPayment("o1", null, { fetcher, baseUrl: "http://api" });
    expect(bodyOf(calls[0])).toEqual({});
  });

  test("quote, create and paymentIntent hit the order service routes", async () => {
    const { calls, fetcher } = fakeFetch();
    const opts = { fetcher, baseUrl: "http://api" };
    await quote({ locationId: "L1", items: [{ menuItemId: "m", quantity: 1 }] }, opts);
    await create({ locationId: "L1", items: [], guestId: "g1" }, { ...opts, headers: { Authorization: "Bearer kiosk_x" } });
    await paymentIntent("o 1", { useCreditsCents: 500, promoCode: null }, opts);
    expect(calls.map((c) => c.url)).toEqual(["http://api/orders/quote", "http://api/orders", "http://api/orders/o%201/payment-intent"]);
    expect(new Headers(calls[1].init.headers).get("Authorization")).toBe("Bearer kiosk_x");
    expect(bodyOf(calls[2])).toEqual({ useCreditsCents: 500, promoCode: null });
  });

  test("kiosk and group confirmations go to their verified batch routes", async () => {
    const { calls, fetcher } = fakeFetch();
    const opts = { fetcher, baseUrl: "http://api" };
    await kioskConfirmPayment(["a", "b"], "pi_t", opts);
    await groupPaymentIntent("ABC234", opts);
    await groupConfirmPayment("ABC234", "pi_g", opts);
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/kiosk/orders/confirm-payment",
      "http://api/group-orders/ABC234/payment-intent",
      "http://api/group-orders/ABC234/confirm-payment",
    ]);
    expect(bodyOf(calls[0])).toEqual({ orderIds: ["a", "b"], paymentIntentId: "pi_t" });
    expect(bodyOf(calls[2])).toEqual({ paymentIntentId: "pi_g" });
  });

  test("refusals come back as a typed error with the translatable code and the refund flag", async () => {
    const { fetcher } = fakeFetch(409, { error: "GIFT_CARD_SHORT", message: "The gift card balance changed.", refunded: true, refundId: "re_1" });
    const res = await confirmPayment("o1", "pi_1", { fetcher });
    expect(res.ok).toBe(false);
    expect(res.data).toBe(null);
    expect(res.status).toBe(409);
    expect(res.error.code).toBe("GIFT_CARD_SHORT");
    expect(res.error.message).toBe("The gift card balance changed.");
    expect(res.error.refunded).toBe(true);
  });

  test("an error message (not a code) and a network failure are both handled", async () => {
    expect(toOrderApiError({ error: "Online ordering is currently unavailable.", code: "DINE_IN_DISABLED" })).toMatchObject({ code: "DINE_IN_DISABLED", message: "Online ordering is currently unavailable." });
    expect(toOrderApiError({ error: "Sign in required" })).toMatchObject({ code: null, message: "Sign in required" });
    const res = await confirmPayment("o1", "pi", { fetcher: async () => { throw new Error("offline"); } });
    expect(res).toEqual({ ok: false, status: 0, data: null, error: { code: "NETWORK_ERROR", message: null } });
  });

  test("groupIdentityHeaders sends the guest session token, never a guest id", () => {
    expect(groupIdentityHeaders({ sessionToken: "tok" })).toEqual({ "x-guest-session": "tok" });
    expect(groupIdentityHeaders(null)).toEqual({});
    expect(groupIdentityHeaders({ sessionToken: null })).toEqual({});
  });

  test("isRetryableFailure: network errors and API 5xx retry; already-paid, refusals and refunded charges don't", () => {
    const err = { code: null, message: null };
    expect(isRetryableFailure({ ok: false, status: 0, error: { code: "NETWORK_ERROR", message: null } })).toBe(true);
    expect(isRetryableFailure({ ok: false, status: 502, error: err })).toBe(true);
    expect(isRetryableFailure({ ok: false, status: 500, error: { ...err, refunded: true } })).toBe(false);
    expect(isRetryableFailure({ ok: false, status: 402, error: err })).toBe(false);
    expect(isRetryableFailure({ ok: false, status: 409, error: err })).toBe(false);
    expect(isRetryableFailure({ ok: true, status: 200, error: err })).toBe(false);
  });

  test("confirmFromWebhook: group PaymentIntents go to the group confirm (no key needed), orders to the order confirm", async () => {
    const { calls, fetcher } = fakeFetch(200, { alreadyPaid: true });
    const g = await confirmFromWebhook({ id: "pi_g", metadata: { kind: "group", groupCode: "ABC234", orderIds: "a,b" } }, { fetcher, baseUrl: "http://api" });
    expect(g).toMatchObject({ handled: "group", ok: true, retry: false });
    expect(calls[0].url).toBe("http://api/group-orders/ABC234/confirm-payment");
    expect(new Headers(calls[0].init.headers).has("x-admin-api-key")).toBe(false);
    const o = await confirmFromWebhook({ id: "pi_o", metadata: { orderId: "o1" } }, { fetcher, baseUrl: "http://api", serviceKey: "k" });
    expect(o).toMatchObject({ handled: "order", ok: true, retry: false });
    expect(calls[1].url).toBe("http://api/orders/o1/confirm-payment");
    expect(await confirmFromWebhook({ id: "pi_x", metadata: { source: "other" } }, { fetcher })).toMatchObject({ handled: null, retry: false });
  });

  test("confirmFromWebhook (D10a): shop PaymentIntents go to the shop confirm, gift cards to the gift card confirm, with the service key", async () => {
    const { calls, fetcher } = fakeFetch(200, { alreadyPaid: false });
    const s = await confirmFromWebhook({ id: "pi_s", metadata: { kind: "shop", shopOrderId: "so 1" } }, { fetcher, baseUrl: "http://api", serviceKey: "k" });
    expect(s).toMatchObject({ handled: "shop", ok: true, retry: false });
    expect(calls[0].url).toBe("http://api/shop/orders/so%201/confirm-payment");
    expect(bodyOf(calls[0])).toEqual({ paymentIntentId: "pi_s" });
    expect(new Headers(calls[0].init.headers).get("x-admin-api-key")).toBe("k");
    const g = await confirmFromWebhook({ id: "pi_g", metadata: { type: "gift_card", amountCents: "2500" } }, { fetcher, baseUrl: "http://api", serviceKey: "k" });
    expect(g).toMatchObject({ handled: "gift_card", ok: true });
    expect(calls[1].url).toBe("http://api/gift-cards/confirm-payment");
    expect(bodyOf(calls[1])).toEqual({ paymentIntentId: "pi_g" });
    expect(String(calls[0].init.body) + String(calls[1].init.body)).not.toMatch(/paymentStatus|amountCents/);
  });

  test("confirmFromWebhook asks Stripe to retry on a network error or an API 5xx, not on a refusal", async () => {
    const down = await confirmFromWebhook({ id: "pi", metadata: { orderId: "o1" } }, { fetcher: async () => { throw new Error("ECONNREFUSED"); } });
    expect(down.retry).toBe(true);
    const five = await confirmFromWebhook({ id: "pi", metadata: { kind: "group", groupCode: "G" } }, { fetcher: fakeFetch(503, { error: "x" }).fetcher });
    expect(five.retry).toBe(true);
    const refused = await confirmFromWebhook({ id: "pi", metadata: { orderId: "o1" } }, { fetcher: fakeFetch(402, { error: "PAYMENT_NOT_VERIFIED" }).fetcher });
    expect(refused).toMatchObject({ ok: false, retry: false, code: "PAYMENT_NOT_VERIFIED" });
  });

  test("confirmFromWebhook (fix round 1): shop and gift card without ADMIN_API_KEY ask Stripe to retry, without calling the API", async () => {
    const { calls, fetcher } = fakeFetch(200, {});
    for (const metadata of [{ kind: "shop", shopOrderId: "so1" }, { type: "gift_card", amountCents: "2500" }]) {
      for (const serviceKey of [null, ""]) {
        const r = await confirmFromWebhook({ id: "pi", metadata }, { fetcher, baseUrl: "http://api", serviceKey });
        expect(r).toMatchObject({ ok: false, retry: true, code: "ADMIN_API_KEY_MISSING" });
      }
    }
    expect(calls).toHaveLength(0);
    // Food orders and groups don't need the key.
    expect(await confirmFromWebhook({ id: "pi", metadata: { orderId: "o1" } }, { fetcher, baseUrl: "http://api" })).toMatchObject({ handled: "order", retry: false });
  });

  test("confirmFromWebhook (fix round 1): a 401/403 from the shop or gift card confirm is a key mismatch, so retry; other 4xx stay final", async () => {
    for (const status of [401, 403]) {
      for (const metadata of [{ kind: "shop", shopOrderId: "so1" }, { type: "gift_card" }]) {
        const r = await confirmFromWebhook({ id: "pi", metadata }, { fetcher: fakeFetch(status, { error: "FORBIDDEN" }).fetcher, serviceKey: "wrong" });
        expect(r).toMatchObject({ ok: false, retry: true, status });
      }
    }
    const refused = await confirmFromWebhook({ id: "pi", metadata: { kind: "shop", shopOrderId: "so1" } }, { fetcher: fakeFetch(402, { error: "PAYMENT_NOT_VERIFIED" }).fetcher, serviceKey: "k" });
    expect(refused).toMatchObject({ ok: false, retry: false, code: "PAYMENT_NOT_VERIFIED" });
    const food = await confirmFromWebhook({ id: "pi", metadata: { orderId: "o1" } }, { fetcher: fakeFetch(403, { error: "FORBIDDEN" }).fetcher, serviceKey: "k" });
    expect(food.retry).toBe(false);
  });

  test("paymentIntentIdFromClientSecret", () => {
    expect(paymentIntentIdFromClientSecret("pi_3Abc_secret_xyz")).toBe("pi_3Abc");
    expect(paymentIntentIdFromClientSecret(null)).toBe(null);
    expect(paymentIntentIdFromClientSecret("garbage")).toBe(null);
  });
});
