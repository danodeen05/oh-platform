// @vitest-environment jsdom
//
// Task E2: the human-tap pay card. Stripe is mocked: these pin the card's
// own rules, not Stripe's.
//  - Nothing is confirmed with the API before Stripe reports the payment
//    succeeded (a decline or an error never reaches confirm-payment).
//  - A double tap starts one charge and one confirm.
//  - A failed confirm retries the confirm only, never the charge.
//  - The confirm-zero card places the order once, with no PaymentIntent.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const h = vi.hoisted(() => ({
  stripe: { confirmPayment: vi.fn(), retrievePaymentIntent: vi.fn() },
  confirm: vi.fn(),
}));

vi.mock("@stripe/react-stripe-js", async () => {
  const { useEffect } = await import("react");
  return {
    Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PaymentElement: ({ onReady }: { onReady?: () => void }) => {
      useEffect(() => onReady?.(), [onReady]);
      return <div data-stripe="payment" />;
    },
    ExpressCheckoutElement: () => <div data-stripe="express" />,
    useStripe: () => h.stripe,
    useElements: () => ({ marker: "elements" }),
  };
});
vi.mock("@/lib/site/orders", () => ({ confirmPayment: h.confirm }));

import { ChappyCardProvider, renderCard } from "../cards";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const onPaid = vi.fn();
const PAID_ORDER = { id: "o1", orderNumber: "ORD-1", kitchenOrderNumber: "0012", totalCents: 656, status: "PAID", paymentStatus: "PAID", seat: { label: "B-07" } };

function mount(card: Record<string, unknown>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="America/Denver">
        <ChappyCardProvider value={{ locale: "en", cjk: false, onSignIn: () => {}, send: () => {}, onPaid, api: vi.fn() as any, busy: false }}>
          {renderCard(card as any)}
        </ChappyCardProvider>
      </NextIntlClientProvider>,
    );
  });
}

const PAY = { type: "pay", orderId: "o1", clientSecret: "pi_1_secret_a", amountDueCents: 656, kitchenNumber: "0012", pod: "B-07" };
const submit = () => host.querySelector<HTMLButtonElement>("[data-pay-submit]")!;
const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  h.stripe.confirmPayment.mockReset();
  h.stripe.retrievePaymentIntent.mockReset();
  h.confirm.mockReset();
  onPaid.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PayCard", () => {
  it("never calls confirm-payment before Stripe says the payment succeeded", async () => {
    mount(PAY);
    const charge = deferred<any>();
    h.stripe.confirmPayment.mockReturnValueOnce(charge.promise);
    await act(async () => submit().click());
    expect(h.stripe.confirmPayment).toHaveBeenCalledTimes(1);
    expect(h.stripe.confirmPayment.mock.calls[0][0]).toMatchObject({ redirect: "if_required", confirmParams: { return_url: expect.stringContaining("chappyPay=o1") } });
    expect(h.confirm).not.toHaveBeenCalled();

    // A decline: still nothing sent to the API, and the customer can try again.
    await act(async () => charge.resolve({ error: { type: "card_error", message: "Your card was declined." } }));
    expect(h.confirm).not.toHaveBeenCalled();
    expect(host.querySelector('[data-pay-status="failed"]')?.textContent).toContain(en.chappyWeb.cards.pay.failed);
    expect(host.textContent).toContain("Your card was declined.");
    expect(onPaid).not.toHaveBeenCalled();

    // The retry succeeds: exactly one confirm, with Stripe's PaymentIntent.
    h.stripe.confirmPayment.mockResolvedValueOnce({ paymentIntent: { id: "pi_1", status: "succeeded" } });
    h.confirm.mockResolvedValueOnce({ ok: true, status: 200, data: PAID_ORDER, error: { code: null, message: null } });
    await act(async () => submit().click());
    await flush();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0].slice(0, 2)).toEqual(["o1", "pi_1"]);
    expect(onPaid).toHaveBeenCalledWith(PAID_ORDER);
    expect(host.querySelector("[data-pay-form]")).toBeNull(); // paid: the form is gone
  });

  it("a network error mid-charge says it didn't finish, not that the card wasn't charged", async () => {
    mount(PAY);
    h.stripe.confirmPayment.mockRejectedValueOnce(new Error("network"));
    await act(async () => submit().click());
    await flush();
    expect(h.confirm).not.toHaveBeenCalled();
    expect(host.querySelector('[data-pay-status="unfinished"]')?.textContent).toContain(en.chappyWeb.cards.pay.unfinished);
    expect(host.textContent).not.toContain(en.chappyWeb.cards.pay.failed);
  });

  it("a status other than succeeded (processing, requires_payment_method) is not confirmed", async () => {
    mount(PAY);
    h.stripe.confirmPayment.mockResolvedValueOnce({ paymentIntent: { id: "pi_1", status: "processing" } });
    await act(async () => submit().click());
    await flush();
    expect(h.confirm).not.toHaveBeenCalled();
    expect(host.querySelector('[data-pay-status="processing"]')).not.toBeNull();
  });

  it("a double tap starts one charge and one confirm", async () => {
    mount(PAY);
    const charge = deferred<any>();
    h.stripe.confirmPayment.mockReturnValue(charge.promise);
    h.confirm.mockResolvedValue({ ok: true, status: 200, data: PAID_ORDER, error: { code: null, message: null } });
    const form = host.querySelector("form")!;
    await act(async () => {
      // Two submits in the same frame, before React re-renders the disabled button.
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => submit().click()); // and a third tap while it's paying
    expect(h.stripe.confirmPayment).toHaveBeenCalledTimes(1);
    await act(async () => charge.resolve({ paymentIntent: { id: "pi_1", status: "succeeded" } }));
    await flush();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("a failed confirm retries the confirm only; the card is never charged twice", async () => {
    mount(PAY);
    h.stripe.confirmPayment.mockResolvedValueOnce({ paymentIntent: { id: "pi_1", status: "succeeded" } });
    h.confirm.mockResolvedValueOnce({ ok: false, status: 0, data: null, error: { code: "NETWORK_ERROR", message: null } });
    await act(async () => submit().click());
    await flush();
    expect(host.querySelector('[data-pay-status="confirmFailed"]')).not.toBeNull();
    h.confirm.mockResolvedValueOnce({ ok: true, status: 200, data: PAID_ORDER, error: { code: null, message: null } });
    await act(async () => host.querySelector<HTMLButtonElement>("[data-pay-retry-confirm]")!.click());
    await flush();
    expect(h.stripe.confirmPayment).toHaveBeenCalledTimes(1);
    expect(h.confirm).toHaveBeenCalledTimes(2);
    expect(h.confirm.mock.calls.map((c) => c[1])).toEqual(["pi_1", "pi_1"]);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("an already-succeeded PaymentIntent (a second tab) is settled, not charged again", async () => {
    mount(PAY);
    h.stripe.confirmPayment.mockResolvedValueOnce({ error: { type: "invalid_request_error", code: "payment_intent_unexpected_state", payment_intent: { id: "pi_1", status: "succeeded" } } });
    h.confirm.mockResolvedValueOnce({ ok: true, status: 200, data: PAID_ORDER, error: { code: null, message: null } });
    await act(async () => submit().click());
    await flush();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmZeroCard", () => {
  it("places the order once, with no PaymentIntent, on the customer's tap", async () => {
    mount({ type: "confirm-zero", orderId: "o1", kitchenNumber: "0012", pod: null });
    expect(h.confirm).not.toHaveBeenCalled();
    const gate = deferred<any>();
    h.confirm.mockReturnValue(gate.promise);
    const button = host.querySelector<HTMLButtonElement>("[data-confirm-zero]")!;
    await act(async () => {
      button.click();
      button.click();
    });
    await act(async () => gate.resolve({ ok: true, status: 200, data: PAID_ORDER, error: { code: null, message: null } }));
    await flush();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0].slice(0, 2)).toEqual(["o1", null]);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });
});
