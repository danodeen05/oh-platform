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

  test("paymentIntentIdFromClientSecret", () => {
    expect(paymentIntentIdFromClientSecret("pi_3Abc_secret_xyz")).toBe("pi_3Abc");
    expect(paymentIntentIdFromClientSecret(null)).toBe(null);
    expect(paymentIntentIdFromClientSecret("garbage")).toBe(null);
  });
});
