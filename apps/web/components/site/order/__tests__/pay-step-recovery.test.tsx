// @vitest-environment jsdom
//
// Final review C1: once Stripe says a PaymentIntent succeeded, PayStep never
// shows Pay again and never asks for a new PaymentIntent for that order. It
// confirms the SAME PaymentIntent (retried), resumes it after a reload or a
// 3DS return, and fetches a fresh one only when the server refunded it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

const h = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
  confirmPayment: vi.fn(),
  paymentIntent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn() }),
  useSearchParams: () => h.search,
}));
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
  useLocale: () => "en",
}));
// The paid view (store D10's PaymentReceived) as a probe: its state and its Retry.
vi.mock("next/dynamic", () => ({
  default: () => (p: { state: string; stuckText: string; onRetry?: () => void }) =>
    createElement("div", { "data-payment-received": p.state }, p.state === "stuck" ? p.stuckText : null, p.onRetry ? createElement("button", { "data-finish-retry": true, onClick: p.onRetry }) : null),
}));
vi.mock("@/components/payments", () => ({
  StripeProvider: ({ children }: { children: ReactNode }) => children,
  PaymentForm: (p: { onSuccess: (id: string) => void }) => createElement("button", { "data-stripe-pay": true, onClick: () => p.onSuccess("pi_1") }),
}));
vi.mock("@/components/site/icons/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/site/picture/SitePicture", () => ({ SitePicture: () => null }));
vi.mock("@/lib/site/pod-walk", () => ({ podWalkSteps: () => null }));
vi.mock("@/lib/site/api", () => ({
  SITE_API_URL: "http://api",
  useMemberId: () => ({ ready: true, signedIn: false, userId: null }),
  useSiteApi: () => async () => ({ ok: true, status: 200, json: async () => ({ id: "o1", orderNumber: "ORD-123456", paymentStatus: "PENDING", orderQrCode: "QR1", items: [] }) }),
}));
vi.mock("@/lib/site/orders", () => ({
  confirmPayment: h.confirmPayment,
  paymentIntent: h.paymentIntent,
  groupIdentityHeaders: () => ({}),
}));
vi.mock("@/contexts/guest-context", () => ({ useGuest: () => ({ guest: { sessionToken: "g" } }) }));
vi.mock("../StepSheet", () => ({
  StepSheet: (p: { alert?: ReactNode; children?: ReactNode }) => createElement("div", { "data-step-sheet": true }, createElement("div", { "data-alert": true }, p.alert), p.children),
  TotalSummary: () => null,
  Spinner: () => null,
}));
vi.mock("../Receipt", () => ({ Receipt: () => null }));
vi.mock("../SignInGate", () => ({ SignInGate: () => null }));
vi.mock("../useOrderDraft", () => ({ useOrderDraft: () => ({ draft: {}, update: vi.fn() }) }));
vi.mock("../order.css", () => ({}));

import { PayStep } from "../PayStep";
import { PENDING_ORDER_KEY } from "@/lib/site/paid-recovery";

const intent = (id: string) => ({
  ok: true,
  status: 200,
  data: {
    clientSecret: `${id}_secret_x`,
    paymentIntentId: id,
    amountDueCents: 1799,
    warnings: [],
    totals: { subtotalCents: 1799, promoDiscountCents: 0, rewardDiscountCents: 0, taxCents: 0, totalCents: 1799, creditsAppliedCents: 0, mealGiftAppliedCents: 0, giftCardAppliedCents: 0, amountDueCents: 1799 },
  },
  error: { code: null, message: null },
});
const okConfirm = { ok: true, status: 200, data: { orderQrCode: "QR1" }, error: { code: null, message: null } };
const notVerified = { ok: false, status: 402, data: null, error: { code: "PAYMENT_NOT_VERIFIED", message: null } };

let root: Root | null = null;
let host: HTMLDivElement;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));
const q = (sel: string) => host.querySelector(sel);

async function mount() {
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(PayStep, { orderId: "o1", orderNumber: "ORD-123456" }));
  });
  await flush();
  await flush();
}

async function click(sel: string) {
  const el = q(sel) as HTMLElement | null;
  expect(el, sel).not.toBeNull();
  await act(async () => el!.click());
  await flush();
  await flush();
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  h.search = new URLSearchParams();
  h.replace.mockReset();
  h.confirmPayment.mockReset();
  h.paymentIntent.mockReset().mockResolvedValue(intent("pi_1"));
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

describe("PayStep after Stripe succeeds (final review C1)", () => {
  it("a failed confirm shows Payment received (no Pay), and Retry confirms the SAME PaymentIntent", async () => {
    h.confirmPayment.mockResolvedValueOnce(notVerified).mockResolvedValueOnce(okConfirm);
    await mount();
    expect(q("[data-stripe-pay]")).not.toBeNull();
    await click("[data-stripe-pay]");

    expect(q('[data-payment-received="stuck"]')).not.toBeNull();
    expect(q("[data-stripe-pay]")).toBeNull(); // never Pay again
    expect(JSON.parse(sessionStorage.getItem(PENDING_ORDER_KEY)!)).toEqual({ orderId: "o1", paymentIntentId: "pi_1" });

    await click("[data-finish-retry]");
    expect(h.confirmPayment).toHaveBeenCalledTimes(2);
    expect(h.confirmPayment.mock.calls.map((c) => c[1])).toEqual(["pi_1", "pi_1"]);
    expect(h.replace).toHaveBeenCalledWith(expect.stringContaining("QR1"));
    expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBeNull();
    // One PaymentIntent for the whole story.
    expect(h.paymentIntent).toHaveBeenCalledTimes(1);
  });

  it("a network failure is retried automatically with the same PaymentIntent", async () => {
    h.confirmPayment.mockResolvedValueOnce({ ok: false, status: 0, data: null, error: { code: "NETWORK_ERROR", message: null } }).mockResolvedValueOnce(okConfirm);
    await mount();
    await click("[data-stripe-pay]");
    await act(async () => new Promise((r) => setTimeout(r, 1100))); // the first backoff step
    await flush();
    expect(h.confirmPayment.mock.calls.map((c) => c[1])).toEqual(["pi_1", "pi_1"]);
    expect(h.replace).toHaveBeenCalledWith(expect.stringContaining("QR1"));
    expect(h.paymentIntent).toHaveBeenCalledTimes(1);
  });

  it("a reload resumes the confirm of the pending PaymentIntent and never makes a new one", async () => {
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: "o1", paymentIntentId: "pi_9" }));
    h.confirmPayment.mockResolvedValue(notVerified);
    await mount();
    expect(h.confirmPayment).toHaveBeenCalledWith("o1", "pi_9", expect.anything());
    expect(q('[data-payment-received="stuck"]')).not.toBeNull();
    expect(q("[data-stripe-pay]")).toBeNull();
    expect(h.paymentIntent).not.toHaveBeenCalled();

    // Retrying (and failing again) still never asks for a new PaymentIntent.
    await click("[data-finish-retry]");
    expect(h.confirmPayment.mock.calls.every((c) => c[1] === "pi_9")).toBe(true);
    expect(h.paymentIntent).not.toHaveBeenCalled();
  });

  it("a pending PaymentIntent for another order is left alone", async () => {
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: "other", paymentIntentId: "pi_9" }));
    await mount();
    expect(h.confirmPayment).not.toHaveBeenCalled();
    expect(h.paymentIntent).toHaveBeenCalledTimes(1);
    expect(q("[data-stripe-pay]")).not.toBeNull();
  });

  it("a 3DS return confirms THAT PaymentIntent; a failure stays on Payment received", async () => {
    h.search = new URLSearchParams("orderId=o1&payment_intent=pi_3ds&redirect_status=succeeded");
    h.confirmPayment.mockResolvedValue(notVerified);
    await mount();
    expect(h.confirmPayment).toHaveBeenCalledWith("o1", "pi_3ds", expect.anything());
    expect(q('[data-payment-received="stuck"]')).not.toBeNull();
    expect(h.paymentIntent).not.toHaveBeenCalled();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("only a refunded charge fetches a fresh PaymentIntent (and Pay comes back)", async () => {
    h.confirmPayment.mockResolvedValueOnce({ ok: false, status: 409, data: null, error: { code: "QUOTE_CHANGED", message: null, refunded: true } });
    h.paymentIntent.mockResolvedValueOnce(intent("pi_1")).mockResolvedValueOnce(intent("pi_2"));
    await mount();
    await click("[data-stripe-pay]");
    expect(h.paymentIntent).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBeNull();
    expect(q("[data-payment-received]")).toBeNull();
    expect(q("[data-stripe-pay]")).not.toBeNull();
    expect(q("[data-alert]")!.textContent).toContain("orderFlow.pay.refunded");
  });
});
