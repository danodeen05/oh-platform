// @vitest-environment jsdom
//
// Final review I1: once Stripe says the group PaymentIntent succeeded, the
// card form is gone. A failed confirm shows Payment received with Retry
// (same PaymentIntent); a reload resumes it; only a refunded charge fetches
// a fresh group PaymentIntent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

const h = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  groupPaymentIntent: vi.fn(),
  groupConfirmPayment: vi.fn(),
  stripeConfirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: h.push }),
  useSearchParams: () => h.search,
}));
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
  useLocale: () => "en",
}));
vi.mock("@/components/site/auth/AuthTriggers", () => ({ SignInTrigger: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/site/auth", () => ({ useSiteAuth: () => ({ isLoaded: true, isSignedIn: true }) }));
vi.mock("@/components/site/chappy/cards/PayCard", () => ({ lazyStripe: () => null, stripeAppearance: () => ({}), stripeLocale: () => "en" }));
vi.mock("@/components/site/icons/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/site/rewards/format", () => ({ formatMoney: (c: number) => `$${c / 100}` }));
vi.mock("@/lib/site/api", () => ({ SITE_API_URL: "http://api", useSiteApi: () => async () => ({ ok: true, status: 200, json: async () => ({}) }) }));
vi.mock("@/lib/site/orders", () => ({ groupPaymentIntent: h.groupPaymentIntent, groupConfirmPayment: h.groupConfirmPayment }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  ExpressCheckoutElement: () => null,
  PaymentElement: ({ onReady }: { onReady: () => void }) => {
    useEffect(() => onReady(), [onReady]);
    return null;
  },
  useStripe: () => ({ confirmPayment: h.stripeConfirm }),
  useElements: () => ({}),
}));

import { GroupPayForm } from "../GroupPayForm";
import { PENDING_GROUP_KEY } from "@/lib/site/paid-recovery";

const intent = (id: string) => ({ ok: true, status: 200, data: { paymentIntentId: id, clientSecret: `${id}_secret_x`, amountCents: 3598, orderIds: ["o1", "o2"] }, error: { code: null, message: null } });
const confirmed = { ok: true, status: 200, data: { alreadyPaid: false, orders: [{ id: "o1" }, { id: "o2" }] }, error: { code: null, message: null } };
const notVerified = { ok: false, status: 402, data: null, error: { code: "PAYMENT_NOT_VERIFIED", message: null } };

let root: Root | null = null;
let host: HTMLDivElement;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));
const q = (sel: string) => host.querySelector(sel);

async function mount() {
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(GroupPayForm, { groupCode: "ABC123", hostOrderId: "o1", hostOrderNumber: "ORD-1" }));
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
  h.search = new URLSearchParams("groupCode=ABC123");
  h.replace.mockReset();
  h.push.mockReset();
  h.groupConfirmPayment.mockReset();
  h.groupPaymentIntent.mockReset().mockResolvedValue(intent("pi_g"));
  h.stripeConfirm.mockReset().mockResolvedValue({ paymentIntent: { id: "pi_g", status: "succeeded" } });
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

describe("GroupPayForm after Stripe succeeds (final review I1)", () => {
  it("a failed confirm hides the card form; Retry confirms the SAME PaymentIntent", async () => {
    h.groupConfirmPayment.mockResolvedValueOnce(notVerified).mockResolvedValueOnce(confirmed);
    await mount();
    expect(q("[data-group-card-form]")).not.toBeNull();
    await click("[data-group-pay-submit]");

    expect(q('[data-payment-received="stuck"]')).not.toBeNull();
    expect(q("[data-group-card-form]")).toBeNull();
    expect(q("[data-group-pay-submit]")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(PENDING_GROUP_KEY)!)).toEqual({ groupCode: "ABC123", paymentIntentId: "pi_g" });

    await click("[data-finish-retry]");
    expect(h.groupConfirmPayment.mock.calls.map((c) => c[1])).toEqual(["pi_g", "pi_g"]);
    expect(h.push).toHaveBeenCalledWith(expect.stringContaining("paid=true"));
    expect(sessionStorage.getItem(PENDING_GROUP_KEY)).toBeNull();
    expect(h.groupPaymentIntent).toHaveBeenCalledTimes(1);
    expect(h.stripeConfirm).toHaveBeenCalledTimes(1);
  });

  it("a reload resumes the pending PaymentIntent and never shows the card form", async () => {
    sessionStorage.setItem(PENDING_GROUP_KEY, JSON.stringify({ groupCode: "abc123", paymentIntentId: "pi_old" }));
    h.groupConfirmPayment.mockResolvedValue(notVerified);
    await mount();
    expect(h.groupConfirmPayment).toHaveBeenCalledWith("abc123", "pi_old", expect.anything());
    expect(h.groupPaymentIntent).not.toHaveBeenCalled();
    expect(q("[data-group-card-form]")).toBeNull();
    expect(q('[data-payment-received="stuck"]')).not.toBeNull();
  });

  it("a refunded charge fetches a fresh group PaymentIntent and says why", async () => {
    h.groupConfirmPayment.mockResolvedValueOnce({ ok: false, status: 409, data: null, error: { code: "PAYMENT_REFUNDED", message: null, refunded: true } });
    h.groupPaymentIntent.mockResolvedValueOnce(intent("pi_g")).mockResolvedValueOnce(intent("pi_new"));
    await mount();
    await click("[data-group-pay-submit]");
    expect(h.groupPaymentIntent).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(PENDING_GROUP_KEY)).toBeNull();
    expect(q("[data-payment-received]")).toBeNull();
    expect(q("[data-group-card-form]")).not.toBeNull();
    expect(host.textContent).toContain("groupOrder.hostPay.refunded");
  });

  it("a declined 3DS return offers the form again, with a reason (M2)", async () => {
    h.search = new URLSearchParams("groupCode=ABC123&payment_intent=pi_g&redirect_status=failed");
    await mount();
    expect(h.groupConfirmPayment).not.toHaveBeenCalled();
    expect(h.groupPaymentIntent).toHaveBeenCalledTimes(1);
    expect(q("[data-group-card-form]")).not.toBeNull();
    expect(host.textContent).toContain("groupOrder.hostPay.failed");
  });
});
