"use client";

/**
 * The meal-gift GIVING flow (Task D9) on /challenges/meal-for-stranger.
 *
 *   form     location, amount chips, an optional note
 *   pay      the Payment Element for exactly that amount (a meal_gift
 *            PaymentIntent the API binds to this giver and location)
 *   record   POST /meal-gifts with the PaymentIntent; the API creates the
 *            gift only after verifying it (succeeded, exact amount,
 *            metadata giver and location match)
 *   done     thank you
 *
 * Money safety: once Stripe says the payment succeeded, the page never shows
 * Pay again for that gift. A failed record keeps the PaymentIntent (and the
 * gift details in sessionStorage) and offers "Try again", which re-sends the
 * same PaymentIntent; the API's one-gift-per-PaymentIntent rule makes that
 * idempotent. A 3DS or wallet redirect comes back here with
 * ?payment_intent=... and is recorded the same way.
 *
 * Fix round 1: a reload (or coming back to the tab) resumes the saved gift
 * from sessionStorage. Its PaymentIntent's status (Stripe.js) decides:
 * succeeded is recorded, unfinished shows the same payment form again,
 * processing waits for the webhook. And if the tab is gone for good, the
 * Stripe webhook records the gift from the PaymentIntent's metadata.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { StripeProvider, PaymentForm } from "@/components/payments";
import { Icon } from "@/components/site/icons/Icon";
import { Spinner } from "@/components/site/order/StepSheet";
import { NIGHT_APPEARANCE, STRIPE_FONTS } from "@/components/site/order/stripe-appearance";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { formatCents, stripeLocale } from "@/lib/site/order-flow";
import {
  MEAL_GIFT_AMOUNTS,
  MEAL_GIFT_DEFAULT_CENTS,
  MEAL_GIFT_MAX_CENTS,
  MEAL_GIFT_MESSAGE_MAX,
  MEAL_GIFT_MIN_CENTS,
  clearPendingGift,
  readPendingGift,
  recordMealGift,
  resumeAction,
  savePendingGift,
  startMealGiftPayment,
  type GiftErrorCode,
  type PendingGift,
  type RecordResult,
  type StartResult,
} from "@/lib/site/meal-gift-give";

export type GiveLocation = { id: string; name: string };

const FORM_ID = "oh-give-pay-form";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PRIMARY = `inline-flex min-h-14 w-full cursor-pointer font-[inherit] items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
const QUIET = `min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[15px] font-semibold text-oh-cream underline underline-offset-4 ${FOCUS}`;
const LABEL = "text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85";

type Phase = "form" | "pay" | "recording" | "recordError" | "done";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function GiveMealFlow({ locations }: { locations: GiveLocation[] }) {
  const t = useTranslations("giveMeal");
  const te = useTranslations("giveMeal.errors");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const api = useSiteApi();
  const member = useMemberId();
  const money = useCallback((c: number) => formatCents(c, locale), [locale]);

  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [amountCents, setAmountCents] = useState<number>(MEAL_GIFT_DEFAULT_CENTS);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [gift, setGift] = useState<PendingGift | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recording = useRef(false);
  const resumed = useRef(false);
  const returning = search.get("payment_intent");

  const errorText = useCallback(
    (code: GiftErrorCode, refunded = false) => {
      const base = te(code, { min: money(MEAL_GIFT_MIN_CENTS), max: money(MEAL_GIFT_MAX_CENTS) });
      return refunded ? `${base} ${t("refunded")}` : base;
    },
    [te, t, money],
  );

  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "";

  const record = useCallback(
    async (g: PendingGift) => {
      if (recording.current) return;
      recording.current = true;
      setGift(g);
      setPhase("recording");
      setError(null);
      const r = await recordMealGift(api, SITE_API_URL, g);
      recording.current = false;
      if (r.ok) {
        clearPendingGift(sessionStore());
        setClientSecret(null);
        setPhase("done");
        return;
      }
      const fail = r as Extract<RecordResult, { ok: false }>;
      if (fail.retry) {
        // Paid, not recorded yet: keep the PaymentIntent and offer Try again (never Pay again).
        setError(t("recordFailed"));
        setPhase("recordError");
        return;
      }
      // The server refused this payment (and refunds it when it was charged). Start over.
      clearPendingGift(sessionStore());
      setClientSecret(null);
      setError(errorText(fail.code, fail.refunded));
      setPhase("form");
    },
    [api, errorText, t],
  );

  // Back from a 3DS or wallet redirect: record the gift saved under this PaymentIntent.
  useEffect(() => {
    if (!returning || !member.ready) return;
    const pending = readPendingGift(sessionStore(), returning);
    router.replace(pathname);
    if (search.get("redirect_status") === "failed") {
      setError(t("failed"));
      return;
    }
    if (pending) {
      if (pending.locationId) setLocationId(pending.locationId);
      setAmountCents(pending.amountCents);
      setMessage(pending.message || "");
      record(pending);
    } else setError(errorText("GENERIC"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning, member.ready]);

  // A reload with a saved gift: pick up where the giver was (fix round 1).
  useEffect(() => {
    if (returning || !member.ready || !member.signedIn || resumed.current) return;
    resumed.current = true;
    const pending = readPendingGift(sessionStore(), null);
    if (!pending?.clientSecret) return;
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return;
    let cancelled = false;
    (async () => {
      const stripe = await loadStripe(key).catch(() => null);
      const result = stripe ? await stripe.retrievePaymentIntent(pending.clientSecret!).catch(() => null) : null;
      if (cancelled || !result) return;
      const action = resumeAction(result.paymentIntent?.status);
      setLocationId(pending.locationId);
      setAmountCents(pending.amountCents);
      setMessage(pending.message || "");
      if (action === "record") record(pending);
      else if (action === "pay") {
        setGift(pending);
        setClientSecret(pending.clientSecret!);
        setPhase("pay");
      } else if (action === "wait") {
        setGift(pending);
        setError(t("recordFailed"));
        setPhase("recordError");
      } else clearPendingGift(sessionStore());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning, member.ready, member.signedIn]);

  async function onContinue() {
    if (!locationId) {
      setError(errorText("LOCATION_REQUIRED"));
      return;
    }
    setBusy(true);
    setError(null);
    const note = message.trim() || null;
    const r = await startMealGiftPayment(api, SITE_API_URL, { locationId, amountCents, message: note });
    setBusy(false);
    if (!r.ok) {
      setError(errorText((r as Extract<StartResult, { ok: false }>).code));
      return;
    }
    const pending: PendingGift = { paymentIntentId: r.paymentIntentId, locationId, amountCents, message: note, clientSecret: r.clientSecret };
    // Saved before Stripe confirms, so a redirect return (or a lost response) can still record it.
    savePendingGift(sessionStore(), pending);
    setGift(pending);
    setClientSecret(r.clientSecret);
    setPhase("pay");
  }

  function reset() {
    clearPendingGift(sessionStore());
    setClientSecret(null);
    setGift(null);
    setError(null);
    setMessage("");
    setPhase("form");
  }

  const alert = error ? (
    <p role="alert" data-give-error className="m-0 rounded-2xl bg-oh-stone px-4 py-3 text-[15px] text-oh-cream">
      {error}
    </p>
  ) : null;

  // ------------------------------------------------------------ done
  if (phase === "done" && gift) {
    return (
      <section data-give-done aria-labelledby="give-done" className="flex flex-col gap-4 rounded-3xl bg-oh-linen p-6 text-oh-charcoal">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream">
          <Icon name="gift" size={28} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oh-charcoal/80">{t("doneEyebrow")}</span>
        <h2 id="give-done" className={`m-0 text-4xl font-normal leading-tight ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>
          {t("doneTitle")}
        </h2>
        <p className="m-0 text-base leading-relaxed">{t("doneBody", { location: nameOf(gift.locationId), amount: money(gift.amountCents) })}</p>
        {gift.message ? <p className="m-0 border-l-2 border-oh-ember-deep pl-3 text-[15px] italic [overflow-wrap:anywhere]">{gift.message}</p> : null}
        <p className="m-0 text-[15px] text-oh-charcoal/80">{t("doneNote")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" data-give-another onClick={reset} className={`inline-flex min-h-12 cursor-pointer font-[inherit] items-center rounded-full border-0 bg-oh-charcoal px-5 text-base font-semibold text-oh-cream ${FOCUS}`}>
            {t("giveAnother")}
          </button>
          <a href={`/${locale}/member`} className="inline-flex min-h-12 items-center rounded-full border border-oh-charcoal/30 px-5 text-base font-semibold text-oh-charcoal no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-charcoal">
            {t("account")}
          </a>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ recording / paid but not recorded
  if ((phase === "recording" || phase === "recordError") && gift) {
    return (
      <section data-give-recording aria-busy={phase === "recording"} className="flex flex-col gap-4 rounded-3xl bg-oh-ink p-5 md:p-6">
        <GiftSummary gift={gift} name={nameOf(gift.locationId)} money={money} />
        {phase === "recording" ? (
          <p role="status" className="m-0 flex items-center gap-3 text-[15px] text-oh-cream">
            <Spinner />
            {t("recording")}
          </p>
        ) : (
          <>
            {alert}
            <button type="button" data-give-retry onClick={() => record(gift)} className={PRIMARY}>
              {t("retry")}
            </button>
          </>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------ pay
  if (phase === "pay" && gift && clientSecret) {
    return (
      <section data-give-pay-step aria-labelledby="give-pay" className="flex flex-col gap-4 rounded-3xl bg-oh-ink p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="give-pay" className={LABEL}>
            {t("payTitle")}
          </h2>
          <button type="button" data-give-edit onClick={() => setPhase("form")} className={QUIET} disabled={busy}>
            {t("edit")}
          </button>
        </div>
        <GiftSummary gift={gift} name={nameOf(gift.locationId)} money={money} />
        <StripeProvider key={clientSecret} clientSecret={clientSecret} locale={stripeLocale(locale)} appearance={NIGHT_APPEARANCE} fonts={STRIPE_FONTS}>
          <PaymentForm
            amountCents={gift.amountCents}
            formId={FORM_ID}
            hideSubmit
            tone="night"
            showExpressCheckout
            returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/challenges/meal-for-stranger`}
            onSuccess={(id) => record({ ...gift, paymentIntentId: id })}
            onError={(m) => setError(m || t("failed"))}
            onProcessingChange={setBusy}
            labels={{ submit: t("pay", { amount: money(gift.amountCents) }), processing: t("processing"), orPayWithCard: t("orPayWithCard"), failed: t("failed"), card: t("card") }}
          />
        </StripeProvider>
        {alert}
        <button type="submit" form={FORM_ID} data-give-pay disabled={busy} className={PRIMARY}>
          {busy ? <Spinner /> : null}
          {busy ? t("processing") : t("pay", { amount: money(gift.amountCents) })}
        </button>
        <p className="m-0 flex items-center gap-2 text-sm text-oh-mute">
          <Icon name="seal" size={16} />
          {t("secure")}
        </p>
      </section>
    );
  }

  // ------------------------------------------------------------ form
  const back = `/${locale}/challenges/meal-for-stranger`;
  return (
    <section data-give-form aria-labelledby="give-form" className="flex flex-col gap-6 rounded-3xl bg-oh-ink p-5 md:p-6">
      <h2 id="give-form" className={`m-0 text-2xl font-normal text-oh-cream ${locale.startsWith("zh") ? "font-display-cjk" : "font-display"}`}>
        {t("formTitle")}
      </h2>

      {locations.length === 0 ? (
        <p data-give-no-locations className="m-0 text-[15px] text-oh-mute">
          {t("noLocations")}
        </p>
      ) : (
        <>
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className={`${LABEL} mb-3 p-0`}>{t("location")}</legend>
            <div role="radiogroup" aria-label={t("location")} className="grid gap-2 sm:grid-cols-2">
              {locations.map((l) => {
                const on = l.id === locationId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-give-location={l.id}
                    onClick={() => setLocationId(l.id)}
                    className={`flex min-h-14 cursor-pointer font-[inherit] items-center gap-3 rounded-2xl border px-4 text-left text-base text-oh-cream ${on ? "border-oh-gold bg-oh-stone/70" : "border-oh-stone bg-oh-charcoal"} ${FOCUS}`}
                  >
                    <Icon name="pin" size={18} className={`shrink-0 ${on ? "text-oh-gold" : "text-oh-mute"}`} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{l.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className={`${LABEL} mb-3 p-0`}>{t("amount")}</legend>
            <div role="radiogroup" aria-label={t("amount")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MEAL_GIFT_AMOUNTS.map((c) => {
                const on = c === amountCents;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-give-amount={c}
                    onClick={() => setAmountCents(c)}
                    className={`min-h-14 cursor-pointer font-[inherit] rounded-2xl border text-lg font-semibold ${on ? "border-oh-gold bg-oh-gold text-oh-charcoal" : "border-oh-stone bg-oh-charcoal text-oh-cream"} ${FOCUS}`}
                  >
                    {money(c)}
                  </button>
                );
              })}
            </div>
            <p className="m-0 mt-2 text-sm text-oh-mute">{t("amountHint", { min: money(MEAL_GIFT_MIN_CENTS), max: money(MEAL_GIFT_MAX_CENTS) })}</p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="give-message" className={LABEL}>
              {t("message")}
            </label>
            <textarea
              id="give-message"
              data-give-message
              value={message}
              maxLength={MEAL_GIFT_MESSAGE_MAX}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              rows={3}
              className="w-full resize-y rounded-2xl border border-oh-stone bg-oh-charcoal px-4 py-3 font-[inherit] text-base text-oh-cream placeholder:text-oh-ash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            />
            <span className="self-end text-sm text-oh-mute">{t("counter", { count: message.length, max: MEAL_GIFT_MESSAGE_MAX })}</span>
          </div>

          <p className="m-0 text-sm text-oh-mute">{t("noCredit")}</p>
          {alert}

          {!member.ready ? (
            <button type="button" disabled className={PRIMARY}>
              <Spinner />
              {t("loading")}
            </button>
          ) : member.signedIn ? (
            <button type="button" data-give-continue onClick={onContinue} disabled={busy || !locationId} className={PRIMARY}>
              {busy ? <Spinner /> : <Icon name="gift" size={20} />}
              {t("continue", { amount: money(amountCents) })}
            </button>
          ) : (
            <div data-give-signin className="flex flex-col gap-3 border-t border-oh-stone pt-5">
              <p className="m-0 text-lg font-semibold text-oh-cream">{t("signInTitle")}</p>
              <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{t("signInBody")}</p>
              <SignInButton mode="modal" forceRedirectUrl={back} signUpForceRedirectUrl={back}>
                <button type="button" data-give-signin-button className={PRIMARY}>
                  {t("signIn")}
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={back} signInForceRedirectUrl={back}>
                <button type="button" className={`${QUIET} self-start font-normal decoration-oh-ember-light decoration-2`}>
                  {t("create")}
                </button>
              </SignUpButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function GiftSummary({ gift, name, money }: { gift: PendingGift; name: string; money: (c: number) => string }) {
  const t = useTranslations("giveMeal");
  return (
    <div data-give-summary className="flex items-center gap-4 rounded-2xl bg-oh-charcoal p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream">
        <Icon name="gift" size={22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-lg font-semibold text-oh-cream [overflow-wrap:anywhere]">{t("summary", { amount: money(gift.amountCents), location: name })}</span>
        {gift.message ? <span className="truncate text-sm italic text-oh-mute">{gift.message}</span> : null}
      </span>
    </div>
  );
}
