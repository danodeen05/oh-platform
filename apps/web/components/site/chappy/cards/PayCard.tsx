"use client";

/**
 * The human-tap pay card (Task E2). Chappy's checkout tool placed an unpaid
 * order and made a PaymentIntent for the server's amount; this card is the
 * only thing that can pay it, and only when the customer taps.
 *
 *  - Stripe's Payment Element (card) and Express Checkout (Apple Pay,
 *    Google Pay) mount with the card's client secret, in the page locale,
 *    styled from the site's --color-oh-* tokens. Card details go to Stripe's
 *    frames; neither Chappy nor this page sees them.
 *  - Tap Pay: stripe.confirmPayment({ redirect: "if_required" }). 3D Secure
 *    runs in Stripe's challenge frame and resolves here. A method that must
 *    leave the page returns to this page with ?chappyPay= (pay-return.ts);
 *    ChappyProvider picks it up and the widget finishes the same way.
 *  - Only a PaymentIntent Stripe reports `succeeded` is sent to the API
 *    (confirmPayment in lib/site/orders.ts), which verifies it with Stripe
 *    again before anything is PAID. Then the widget posts the system note
 *    and the order's status card (ChappyCardContext.onPaid).
 *  - Double-tap safe: one charge attempt at a time (a ref, not state, so two
 *    taps in the same frame can't both start), and one confirm per
 *    PaymentIntent. A failed confirm retries the CONFIRM only, never the charge.
 */
import { ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent, StripeExpressCheckoutElementReadyEvent } from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StripeProvider, stripeLocale } from "@/components/payments/StripeProvider";
import { Icon } from "@/components/site/icons/Icon";
import { confirmPayment } from "@/lib/site/orders";
import { CardFrame, Eyebrow, PrimaryButton, QuietButton, money, podText, useCardContext } from "./CardKit";
import { chappyReturnUrl } from "./pay-return";
import type { PayCardData } from "./types";

export type PayPhase = "ready" | "paying" | "confirming" | "paid" | "failed" | "confirmFailed" | "refunded" | "processing";

const FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&display=swap" }];

/** The site's tokens, read at runtime (Stripe's frames can't see CSS variables); the fallbacks are the same values. */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-oh-${name}`).trim();
  return v || fallback;
}

export function stripeAppearance() {
  const ink = token("ink", "#2A2724");
  const charcoal = token("charcoal", "#1C1B19");
  const stone = token("stone", "#3A3632");
  const cream = token("cream", "#F2EDE4");
  const mute = token("mute", "#9A9188");
  const ash = token("ash", "#8A8178");
  const emberLight = token("ember-light", "#E07A5A");
  return {
    theme: "night" as const,
    variables: {
      colorPrimary: emberLight,
      colorBackground: charcoal,
      colorText: cream,
      colorTextSecondary: mute,
      colorTextPlaceholder: ash,
      colorIcon: mute,
      colorDanger: emberLight,
      fontFamily: 'Raleway, "Noto Sans TC", "Noto Sans SC", system-ui, sans-serif',
      fontSizeBase: "16px",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { border: `1px solid ${stone}`, boxShadow: "none", backgroundColor: charcoal },
      ".Input:focus": { border: `1px solid ${emberLight}`, boxShadow: `0 0 0 1px ${emberLight}` },
      ".Label": { fontWeight: "600", fontSize: "13px", color: mute },
      ".Tab": { border: `1px solid ${stone}`, backgroundColor: charcoal, boxShadow: "none", color: mute },
      ".Tab:hover": { color: cream },
      ".Tab--selected": { borderColor: emberLight, backgroundColor: ink, color: cream },
      ".Tab--selected:focus": { borderColor: emberLight, boxShadow: `0 0 0 1px ${emberLight}` },
      ".TabIcon": { fill: mute },
      ".TabIcon--selected": { fill: cream },
      ".TabLabel--selected": { color: cream },
      ".Block": { backgroundColor: charcoal, borderColor: stone },
    },
  };
}

export function PayCard({ card }: { card: PayCardData }) {
  const t = useTranslations("chappyWeb.cards");
  const { locale, cjk } = useCardContext();
  const [amount, setAmount] = useState<number | null>(card.amountDueCents);
  const [phase, setPhase] = useState<PayPhase>("ready");
  const appearance = useMemo(() => stripeAppearance(), []);
  const paid = phase === "paid";

  return (
    <CardFrame type="pay" label={t("pay.label")} className={paid ? "chappy-card--settled" : ""}>
      <div className="flex items-start gap-4 px-4 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          <Eyebrow>{paid ? t("pay.paidTitle") : t("pay.title")}</Eyebrow>
          <p className="sr-only">{t("pay.amountLabel")}</p>
          <p data-pay-amount className={`${cjk ? "font-display-cjk" : "font-display"} m-0 mt-1 text-[2.5rem] font-normal leading-none tabular-nums text-oh-cream`}>
            {amount !== null ? money(amount, locale) : <span className="inline-block h-9 w-28 animate-pulse rounded-md bg-oh-stone/70 align-middle" />}
          </p>
          <PayMeta kitchenNumber={card.kitchenNumber} pod={card.pod} />
        </div>
        {paid ? (
          <span className="chappy-paid-mark mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-olive text-oh-cream">
            <Icon name="check" size={26} />
          </span>
        ) : null}
      </div>

      {paid ? null : (
        <div className="border-0 border-t border-solid border-oh-stone/70 px-4 pb-4 pt-4">
          <StripeProvider clientSecret={card.clientSecret} appearance={appearance} locale={stripeLocale(locale)} fonts={FONTS}>
            <PayForm card={card} amount={amount} onAmount={setAmount} phase={phase} setPhase={setPhase} />
          </StripeProvider>
        </div>
      )}
    </CardFrame>
  );
}

export function PayMeta({ kitchenNumber, pod }: { kitchenNumber?: string | null; pod?: string | null }) {
  const t = useTranslations("chappyWeb.cards.pay");
  return (
    <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-oh-cream/75">
      {kitchenNumber ? <span className="tabular-nums">{t("order", { number: kitchenNumber })}</span> : null}
      <span className="inline-flex items-center gap-1.5">
        <Icon name="pod" size={16} className="shrink-0 text-oh-ember-light" />
        {pod ? t("pod", { pod: podText(pod) }) : t("podLater")}
      </span>
    </p>
  );
}

function PayForm({
  card,
  amount,
  onAmount,
  phase,
  setPhase,
}: {
  card: PayCardData;
  amount: number | null;
  onAmount: (cents: number) => void;
  phase: PayPhase;
  setPhase: (p: PayPhase) => void;
}) {
  const t = useTranslations("chappyWeb.cards.pay");
  const tw = useTranslations("chappyWeb");
  const stripe = useStripe();
  const elements = useElements();
  const { api, onPaid, locale } = useCardContext();

  /** A charge attempt is running (set synchronously, so a second tap in the same frame is a no-op). */
  const charging = useRef(false);
  /** A confirm call is running. */
  const confirming = useRef(false);
  /** The order is PAID: nothing more happens on this card. */
  const done = useRef(false);
  /** The PaymentIntent that succeeded, kept so a failed confirm can retry without charging again. */
  const [succeededId, setSucceededId] = useState<string | null>(null);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const [expressShown, setExpressShown] = useState(false);

  // A card rebuilt from a redirect return has no amount: ask Stripe for it.
  useEffect(() => {
    if (amount !== null || !stripe) return;
    let live = true;
    stripe
      .retrievePaymentIntent(card.clientSecret)
      .then((r) => {
        if (live && r.paymentIntent && typeof r.paymentIntent.amount === "number") onAmount(r.paymentIntent.amount);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [amount, stripe, card.clientSecret, onAmount]);

  const settle = useCallback(
    async (paymentIntentId: string) => {
      if (done.current || confirming.current) return;
      confirming.current = true;
      setSucceededId(paymentIntentId);
      setPhase("confirming");
      try {
        const res = await confirmPayment(card.orderId, paymentIntentId, { fetcher: api });
        if (res.ok) {
          done.current = true;
          setPhase("paid");
          onPaid(res.data);
          return;
        }
        if (res.error.refunded) setPhase("refunded");
        else setPhase("confirmFailed");
      } finally {
        confirming.current = false;
      }
    },
    [api, card.orderId, onPaid, setPhase],
  );

  const charge = useCallback(async () => {
    if (!stripe || !elements || charging.current || confirming.current || done.current) return;
    charging.current = true;
    setStripeMessage(null);
    setPhase("paying");
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: chappyReturnUrl(card.orderId, locale, window.location.href) },
        redirect: "if_required",
      });
      if (error) {
        // Already paid (a second tab, an earlier tap): settle that payment, never charge again.
        const pi = error.payment_intent;
        if (pi && pi.status === "succeeded" && pi.id) {
          await settle(pi.id);
          return;
        }
        // An incomplete field: Stripe marks it in the form; nothing to add.
        if (error.type === "validation_error") {
          setPhase("ready");
          return;
        }
        // Stripe's message is in the page locale (Elements' locale); a card decline is worth showing.
        setStripeMessage(error.type === "card_error" && error.message ? error.message : null);
        setPhase("failed");
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        await settle(paymentIntent.id);
      } else if (paymentIntent?.status === "processing") {
        // The webhook settles it once the bank clears it.
        setPhase("processing");
      } else {
        setPhase("failed");
      }
    } catch {
      setPhase("failed");
    } finally {
      charging.current = false;
    }
  }, [stripe, elements, card.orderId, locale, settle, setPhase]);

  const onExpressConfirm = useCallback(
    (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (charging.current || confirming.current || done.current) {
        event.paymentFailed({ reason: "fail" });
        return;
      }
      void charge();
    },
    [charge],
  );

  const onExpressReady = useCallback((event: StripeExpressCheckoutElementReadyEvent) => {
    const methods = event.availablePaymentMethods;
    setExpressShown(Boolean(methods && Object.values(methods).some(Boolean)));
  }, []);

  const busy = phase === "paying" || phase === "confirming";
  const locked = busy || phase === "processing" || phase === "refunded";
  const payLabel = amount !== null ? t("payButton", { amount: money(amount, locale) }) : t("payButton", { amount: "" }).trim();

  return (
    <form
      data-pay-form
      onSubmit={(e) => {
        e.preventDefault();
        void charge();
      }}
      noValidate
    >
      <div className={expressShown ? "" : "h-0 overflow-hidden"} aria-hidden={expressShown ? undefined : true}>
        <ExpressCheckoutElement
          onConfirm={onExpressConfirm}
          onReady={onExpressReady}
          options={{
            buttonHeight: 48,
            buttonTheme: { applePay: "white", googlePay: "white" },
            buttonType: { applePay: "order", googlePay: "order" },
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
            layout: { maxColumns: 1, maxRows: 2, overflow: "never" },
          }}
        />
      </div>
      {expressShown ? (
        <p className="m-0 my-4 flex items-center gap-3 text-xs text-oh-mute">
          <span aria-hidden="true" className="h-px flex-1 bg-oh-stone" />
          {t("or")}
          <span aria-hidden="true" className="h-px flex-1 bg-oh-stone" />
        </p>
      ) : null}

      {!elementReady ? (
        <p role="status" className="m-0 mb-3 flex items-center gap-3 text-sm text-oh-mute">
          <span className="chappy-brush" aria-hidden="true" />
          {t("loading")}
        </p>
      ) : null}
      <div className={elementReady ? "" : "min-h-[180px]"}>
        <PaymentElement
          onReady={() => setElementReady(true)}
          options={{
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never", link: "never" },
            defaultValues: { billingDetails: { address: { country: "US" } } },
          }}
        />
      </div>

      {phase === "failed" || phase === "confirmFailed" || phase === "refunded" || phase === "processing" ? (
        <div data-pay-status={phase} role={phase === "processing" ? "status" : "alert"} className="mt-4 flex gap-2 text-[0.95rem] leading-snug text-oh-ember-light">
          <Icon name={phase === "processing" ? "clock" : "alert"} size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="m-0">{t(phase)}</p>
            {phase === "failed" && stripeMessage ? <p className="m-0 mt-1 text-sm text-oh-cream/75">{stripeMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {phase === "confirmFailed" && succeededId ? (
        <QuietButton data-pay-retry-confirm onClick={() => void settle(succeededId)} className="mt-3">
          {tw("retry")}
        </QuietButton>
      ) : (
        <PrimaryButton type="submit" data-pay-submit disabled={!stripe || !elements || !elementReady || locked} busy={busy} className="mt-5">
          {phase === "paying" ? t("paying") : phase === "confirming" ? t("confirming") : payLabel}
        </PrimaryButton>
      )}

      <p className="m-0 mt-3 flex items-start gap-2 text-xs leading-relaxed text-oh-mute">
        <Icon name="seal" size={14} className="mt-0.5 shrink-0" />
        <span>{t("secure")}</span>
      </p>
    </form>
  );
}
