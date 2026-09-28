"use client";

/**
 * Task D11: the host pays for the whole group (replaces the legacy
 * group-payment-form.tsx), on the verified batch confirm (A7):
 *
 *  1. POST /group-orders/:code/payment-intent: ONE PaymentIntent for the sum
 *     of the unpaid orders' server-quoted amounts (never a client amount).
 *     A revisit after a finished payment comes back `alreadyPaid`: never
 *     charge again.
 *  2. Stripe's Payment Element (and Apple Pay / Google Pay) confirm it here;
 *     3D Secure resolves in place or returns to this page with
 *     ?payment_intent=, which confirms that same PaymentIntent.
 *  3. POST /group-orders/:code/confirm-payment: the API verifies it with
 *     Stripe and marks every order PAID in one step.
 *  4. POST /group-orders/:code/complete with the lobby's pod picks
 *     ({orderId, label}, fill: true): the API claims each pod race-safe and
 *     gives anyone whose pod was taken the next best one.
 *
 * Only the signed-in host can pay (the API checks). Styling and the Stripe
 * appearance and locale are shared with Chappy's pay card.
 */
import { SignInButton, useUser } from "@clerk/nextjs";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent, StripeExpressCheckoutElementReadyEvent } from "@stripe/stripe-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazyStripe, stripeAppearance, stripeLocale } from "@/components/site/chappy/cards/PayCard";
import { Icon } from "@/components/site/icons/Icon";
import { formatMoney } from "@/components/site/rewards/format";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";
import { decodePods, encodePods, type Picks } from "@/lib/site/group";
import { localizedHref } from "@/lib/site/nav";
import { groupConfirmPayment, groupPaymentIntent, type OrderApiError } from "@/lib/site/orders";

const FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&display=swap" }];
const primary =
  "inline-flex min-h-12 w-full cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline shadow-[0_10px_30px_-12px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-wait disabled:opacity-70";

type Phase = "loading" | "ready" | "paying" | "confirming" | "seating" | "failed" | "unfinished" | "processing" | "error";

export function GroupPayForm({ groupCode, hostOrderId, hostOrderNumber }: { groupCode: string; hostOrderId: string; hostOrderNumber: string | null }) {
  const t = useTranslations("groupLobby.payment");
  const th = useTranslations("groupOrder.hostPay");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const api = useSiteApi();
  const { isLoaded, isSignedIn } = useUser();
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [intent, setIntent] = useState<{ clientSecret: string | null; amountCents: number; orderCount: number } | null>(null);
  const started = useRef(false);
  const picks: Picks = useMemo(() => decodePods(params.get("pods")), [params]);
  const stripe = useMemo(() => lazyStripe(), []);
  const appearance = useMemo(() => stripeAppearance(), []);

  const messageFor = useCallback(
    (err: OrderApiError, status: number) => {
      if (err.refunded) return th("refunded");
      if (status === 403) return th("notHost");
      switch (err.code) {
        case "NOTHING_TO_PAY":
          return th("nothingToPay");
        case "GROUP_CHANGED":
        case "QUOTE_CHANGED":
        case "CREDIT_SHORT":
        case "GIFT_CARD_SHORT":
        case "MEAL_GIFT_UNAVAILABLE":
        case "REWARD_UNAVAILABLE":
          return th("groupChanged");
        case "PAYMENT_NOT_VERIFIED":
        case "PAYMENT_REQUIRED":
          return th("notVerified");
        default:
          return th("failed");
      }
    },
    [th],
  );

  /** Pods, then the kitchen (host-only on the API). Payment is already recorded, so this never blocks the confirmation. */
  const finish = useCallback(
    async (orderCount: number) => {
      setPhase("seating");
      try {
        await api(`${SITE_API_URL}/group-orders/${encodeURIComponent(groupCode)}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
          body: JSON.stringify({ pods: Object.entries(picks).map(([orderId, label]) => ({ orderId, label })), fill: true }),
        });
      } catch {
        /* seating is retried by staff at arrival; the payment stands */
      }
      router.push(localizedHref(locale, `/order/confirmation?orderId=${hostOrderId}${hostOrderNumber ? `&orderNumber=${encodeURIComponent(hostOrderNumber)}` : ""}&groupCode=${groupCode}&orderCount=${orderCount}&paid=true`));
    },
    [api, groupCode, hostOrderId, hostOrderNumber, locale, picks, router],
  );

  const confirm = useCallback(
    async (paymentIntentId: string | null, orderCount: number) => {
      setPhase("confirming");
      setMessage(null);
      const res = await groupConfirmPayment(groupCode, paymentIntentId, { fetcher: api, baseUrl: SITE_API_URL });
      if (!res.ok) {
        setMessage(messageFor(res.error, res.status));
        setPhase("error");
        return;
      }
      await finish(res.data.orders?.length || orderCount);
    },
    [api, finish, groupCode, messageFor],
  );

  // Back from a redirect (3D Secure, a wallet): confirm THAT PaymentIntent, never start a new one.
  const returned = params.get("payment_intent");
  const returnedStatus = params.get("redirect_status");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) return;
    started.current = true;
    if (returned) {
      if (returnedStatus === "succeeded" || returnedStatus === "processing") void confirm(returned, 1);
      else {
        setMessage(th("failed"));
        setPhase("error");
      }
      return;
    }
    (async () => {
      const res = await groupPaymentIntent(groupCode, { fetcher: api, baseUrl: SITE_API_URL });
      if (!res.ok) {
        setMessage(messageFor(res.error, res.status));
        setPhase("error");
        return;
      }
      if (res.data.alreadyPaid) {
        await finish(res.data.orderIds?.length || 1);
        return;
      }
      setIntent({ clientSecret: res.data.clientSecret, amountCents: res.data.amountCents, orderCount: res.data.orderIds?.length || 1 });
      setPhase("ready");
    })();
  }, [isLoaded, isSignedIn, returned, returnedStatus, groupCode, api, confirm, finish, messageFor, th]);

  if (!isLoaded) {
    return (
      <p role="status" className="m-0 text-base text-oh-mute">
        {th("loading")}
      </p>
    );
  }

  if (!isSignedIn) {
    return (
      <div data-group-signin>
        <p className="m-0 text-lg font-semibold text-oh-cream">{th("signInTitle")}</p>
        <p className="m-0 mt-1 text-base text-oh-cream/75">{th("signInBody")}</p>
        <SignInButton mode="modal">
          <button type="button" className={`${primary} mt-5`}>
            {th("signIn")}
          </button>
        </SignInButton>
      </div>
    );
  }

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?groupCode=${encodeURIComponent(groupCode)}${Object.keys(picks).length ? `&pods=${encodeURIComponent(encodePods(picks))}` : ""}`
      : "";

  return (
    <div data-group-pay-form>
      {phase === "error" && message ? (
        <p role="alert" className="m-0 mb-4 flex items-start gap-2 rounded-2xl border border-oh-ember-light/40 bg-oh-ember-deep/15 px-4 py-3 text-base text-oh-cream">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
          {message}
        </p>
      ) : null}
      {phase === "loading" || phase === "confirming" || phase === "seating" ? (
        <p role="status" className="m-0 flex items-center gap-3 text-base text-oh-mute">
          <Icon name="clock" size={18} />
          {phase === "loading" ? th("loading") : phase === "confirming" ? th("processing") : t("seating")}
        </p>
      ) : null}

      {intent && intent.amountCents > 0 && intent.clientSecret && phase !== "confirming" && phase !== "seating" ? (
        <Elements stripe={stripe} options={{ clientSecret: intent.clientSecret, appearance, locale: stripeLocale(locale), fonts: FONTS, loader: "auto" }}>
          <CardStep
            amountCents={intent.amountCents}
            returnUrl={returnUrl}
            phase={phase}
            setPhase={setPhase}
            onSucceeded={(id) => void confirm(id, intent.orderCount)}
          />
        </Elements>
      ) : null}

      {intent && intent.amountCents === 0 && phase === "ready" ? (
        <button type="button" className={primary} onClick={() => void confirm(null, intent.orderCount)}>
          {th("confirmFree")}
        </button>
      ) : null}
    </div>
  );
}

function CardStep({
  amountCents,
  returnUrl,
  phase,
  setPhase,
  onSucceeded,
}: {
  amountCents: number;
  returnUrl: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  onSucceeded: (paymentIntentId: string) => void;
}) {
  const t = useTranslations("groupLobby.payment");
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const charging = useRef(false);
  const [ready, setReady] = useState(false);
  const [express, setExpress] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!stripe || !elements || charging.current) return;
    charging.current = true;
    setDeclined(null);
    setPhase("paying");
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
      if (error) {
        const pi = error.payment_intent;
        if (pi && pi.status === "succeeded" && pi.id) return onSucceeded(pi.id);
        if (error.type === "validation_error") return setPhase("ready");
        if (error.type === "card_error") {
          setDeclined(error.message || null);
          return setPhase("failed");
        }
        return setPhase("unfinished");
      }
      if (paymentIntent?.status === "succeeded") onSucceeded(paymentIntent.id);
      else if (paymentIntent?.status === "processing") setPhase("processing");
      else setPhase("unfinished");
    } catch {
      setPhase("unfinished");
    } finally {
      charging.current = false;
    }
  }, [stripe, elements, returnUrl, onSucceeded, setPhase]);

  const onExpressConfirm = useCallback(
    (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements || charging.current) {
        event.paymentFailed({ reason: "fail" });
        return;
      }
      void charge();
    },
    [charge, stripe, elements],
  );
  const onExpressReady = useCallback((event: StripeExpressCheckoutElementReadyEvent) => {
    const m = event.availablePaymentMethods;
    setExpress(Boolean(m && Object.values(m).some(Boolean)));
  }, []);

  const busy = phase === "paying";
  return (
    <form
      data-group-card-form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void charge();
      }}
    >
      <div className={express ? "" : "h-0 overflow-hidden"} aria-hidden={express ? undefined : true}>
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
      {express ? (
        <p className="m-0 my-4 flex items-center gap-3 text-sm text-oh-mute">
          <span aria-hidden="true" className="h-px flex-1 bg-oh-stone" />
          {t("or")}
          <span aria-hidden="true" className="h-px flex-1 bg-oh-stone" />
        </p>
      ) : null}
      {!ready ? (
        <p role="status" className="m-0 mb-3 text-base text-oh-mute">
          {t("loadingForm")}
        </p>
      ) : null}
      <div className={ready ? "" : "min-h-[180px]"}>
        <PaymentElement
          onReady={() => setReady(true)}
          options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never", link: "never" }, defaultValues: { billingDetails: { address: { country: "US" } } } }}
        />
      </div>
      {phase === "failed" || phase === "unfinished" || phase === "processing" ? (
        <div role={phase === "processing" ? "status" : "alert"} className="mt-4 flex gap-2 text-base text-oh-ember-light">
          <Icon name={phase === "processing" ? "clock" : "alert"} size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="m-0">{phase === "failed" ? t("cardFailed") : phase === "processing" ? t("processing") : t("unfinished")}</p>
            {phase === "failed" && declined ? <p className="m-0 mt-1 text-sm text-oh-cream/75">{declined}</p> : null}
          </div>
        </div>
      ) : null}
      <button type="submit" data-group-pay-submit disabled={!stripe || !elements || !ready || busy || phase === "processing"} aria-busy={busy || undefined} className={`${primary} mt-5`}>
        {busy ? t("paying") : t("payButton", { amount: formatMoney(amountCents, locale) })}
      </button>
      <p className="m-0 mt-3 flex items-start gap-2 text-sm text-oh-mute">
        <Icon name="seal" size={14} className="mt-0.5 shrink-0" />
        <span>{t("secure")}</span>
      </p>
    </form>
  );
}
