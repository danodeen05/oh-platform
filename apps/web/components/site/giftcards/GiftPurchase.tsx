"use client";

/**
 * Send a gift card (Task D10, /gift-cards/purchase): amount and face, who
 * it's for, then pay. The face value is the buyer's choice, whole dollars
 * from $10 to $500 (validated here and by the API). A gift card is paid in
 * full by card: there are no promo code or credit controls on this page at
 * all, and the API refuses them (400 NOT_ALLOWED_FOR_GIFT_CARDS).
 *
 * Money path: POST /create-payment-intent {kind:"gift_card", amountCents, ...}
 * builds the PaymentIntent and its metadata on the server; after Stripe
 * succeeds, POST /gift-cards with the PaymentIntent id issues the card only
 * once the API has verified that payment. A 3DS redirect comes back here with
 * ?payment_intent= and finishes from the draft kept in sessionStorage (the
 * Stripe webhook issues the card too, so a lost page never loses a paid card).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";

// Task G2b: Stripe loads at the pay step, not with the page (the first screen
// is a form). Both chunks are fetched when the payment section mounts.
const StripeProvider = dynamic(() => import("@/components/payments/StripeProvider").then((m) => m.StripeProvider), { ssr: false });
const PaymentForm = dynamic(() => import("@/components/payments/PaymentForm").then((m) => m.PaymentForm), { ssr: false });
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Display, Eyebrow, Title } from "@/components/site/Text";
import { FIELD, LABEL, MoneyRow, PANEL, PANEL_TITLE, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/site/store/ui";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { formatCents, stripeLocale } from "@/lib/site/order-flow";
import { toOrderApiError } from "@/lib/site/orders";
import { NIGHT_APPEARANCE, STRIPE_FONTS } from "@/lib/site/stripe-night";
import { GIFT_DESIGNS, GIFT_MAX_DOLLARS, GIFT_MIN_DOLLARS, GIFT_PRESETS, giftAmountValid, giftDesign, giftErrorCode, parseGiftDollars, type GiftDesign } from "@/lib/site/store";
import { GiftCardFace } from "./GiftCardFace";
import { PaymentReceived, type ReceivedState } from "@/components/site/store/PaymentReceived";
import { clearPending, finishWithRetry, isPendingGift, loadPending, PENDING_GIFT_KEY, retryable, savePending, type FinishResult, type PendingGift } from "@/lib/site/paid-recovery";

const FORM_ID = "oh-gift-pay-form";
const DRAFT_KEY = "oh-gift-draft";
const MESSAGE_MAX = 500;
const STEPS = ["amount", "recipient", "pay"] as const;
type Step = (typeof STEPS)[number] | "done";

type Draft = { dollars: number; design: GiftDesign; name: string; email: string; message: string };
type Issued = { code: string; amountCents: number; recipientEmail: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GiftPurchase() {
  const t = useTranslations("giftCards");
  const tp = useTranslations("giftCards.purchase");
  const te = useTranslations("giftCards.errors");
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const api = useSiteApi();
  const ids = useId();
  const alertRef = useRef<HTMLDivElement>(null);
  const money = useCallback((dollars: number) => formatCents(dollars * 100, locale), [locale]);
  usePublishOrderBack(`/${locale}/gift-cards`, tp("back"));

  const initial = parseGiftDollars(search.get("amount") || "");
  const [dollars, setDollars] = useState<number | null>(giftAmountValid(initial) ? initial : 50);
  const [custom, setCustom] = useState(giftAmountValid(initial) && !(GIFT_PRESETS as readonly number[]).includes(initial) ? String(initial) : "");
  const [design, setDesign] = useState<GiftDesign>(giftDesign(search.get("design")));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<Step>("amount");
  const [touched, setTouched] = useState(false);
  const [pi, setPi] = useState<{ clientSecret: string; id: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const returning = search.get("payment_intent");
  const redirectStatus = search.get("redirect_status");
  const issuing = useRef(false);
  // Fix round 1: after Stripe succeeds the page only issues the card (never Pay again).
  const [paid, setPaid] = useState<PendingGift<Draft | null> | null>(null);
  const [paidState, setPaidState] = useState<ReceivedState>("finishing");
  // Bumped to load a fresh PaymentIntent (after a failed redirect return, or a payment that never succeeded).
  const [piNonce, setPiNonce] = useState(0);
  const resumed = useRef(false);
  // The gift the current PaymentIntent was made for: one PaymentIntent per gift, not per render.
  const piFor = useRef<string | null>(null);

  const showAlert = useCallback((text: string | null) => {
    setAlert(text);
    if (text) requestAnimationFrame(() => alertRef.current?.focus());
  }, []);

  const customDollars = custom ? parseGiftDollars(custom) : null;
  const amountOk = giftAmountValid(dollars);
  const nameOk = name.trim().length > 0;
  const emailOk = EMAIL.test(email.trim());

  /** One POST /gift-cards for a succeeded PaymentIntent (the server verifies it; idempotent for the same buyer). */
  const issueOnce = useCallback(
    async (paymentIntentId: string, d: Draft): Promise<FinishResult & { body: { code?: string; amountCents?: number; recipientEmail?: string | null } | null }> => {
      const res = await api(`${SITE_API_URL}/gift-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: d.dollars * 100, designId: d.design, recipientName: d.name, recipientEmail: d.email, personalMessage: d.message || undefined, stripePaymentId: paymentIntentId }),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      const ok = Boolean(res?.ok && body?.code);
      return { ok, status: res ? res.status : 0, error: ok ? null : toOrderApiError(body), body };
    },
    [api],
  );

  /**
   * Issues the card for a succeeded PaymentIntent, retried with the same id.
   * A payment that never succeeded (402) goes back to a fresh PaymentIntent;
   * anything else stays on "Payment received" with Retry and support.
   */
  const finishIssue = useCallback(
    async (p: PendingGift<Draft | null>) => {
      if (issuing.current) return;
      issuing.current = true;
      setPaid(p);
      setPaidState("finishing");
      showAlert(null);
      try {
        const d = p.draft;
        if (!d) {
          // No draft to send (another device, cleared storage): the webhook issues the card from the payment.
          setPaidState("stuck");
          return;
        }
        const res = await finishWithRetry(() => issueOnce(p.paymentIntentId, d));
        if (res.ok && res.body?.code) {
          clearPending(sessionStorageOrNull(), PENDING_GIFT_KEY);
          clearPending(sessionStorageOrNull(), DRAFT_KEY);
          setIssued({ code: res.body.code, amountCents: res.body.amountCents ?? d.dollars * 100, recipientEmail: res.body.recipientEmail ?? d.email });
          setPaid(null);
          setStep("done");
          window.scrollTo({ top: 0 });
          return;
        }
        const code = giftErrorCode(res.error?.code, res.status);
        if (!retryable(res) && (res.status === 402 || code === "PAYMENT_REQUIRED")) {
          // The payment itself didn't succeed: nothing was charged, pay again with a fresh PaymentIntent.
          clearPending(sessionStorageOrNull(), PENDING_GIFT_KEY);
          setPaid(null);
          piFor.current = null;
          setPi(null);
          setStep("pay");
          setPiNonce((n) => n + 1);
          showAlert(te("PAYMENT_REQUIRED"));
          return;
        }
        setPaidState("stuck");
      } finally {
        issuing.current = false;
      }
    },
    [issueOnce, showAlert, te],
  );

  /** Stripe succeeded in this page: remember the PaymentIntent (a reload resumes) and issue the card. */
  function paymentSucceeded(paymentIntentId: string) {
    const d: Draft = { dollars: dollars!, design, name: name.trim(), email: email.trim(), message: message.trim() };
    const p = { paymentIntentId, draft: d };
    savePending(sessionStorageOrNull(), PENDING_GIFT_KEY, p);
    finishIssue(p);
  }

  // Back from a 3DS or wallet redirect: finish from the saved draft, or (payment failed) pay again.
  useEffect(() => {
    if (!returning) return;
    resumed.current = true;
    let d: Draft | null = null;
    try {
      d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      d = null;
    }
    if (d && giftAmountValid(d.dollars)) {
      setDollars(d.dollars);
      setDesign(giftDesign(d.design));
      setName(d.name);
      setEmail(d.email);
      setMessage(d.message);
    }
    router.replace(`/${locale}/gift-cards/purchase`);
    if (redirectStatus && redirectStatus !== "succeeded" && redirectStatus !== "processing") {
      setStep(d ? "pay" : "amount");
      showAlert(te("PAYMENT_REQUIRED"));
      setPiNonce((n) => n + 1);
      return;
    }
    const p = { paymentIntentId: returning, draft: d && giftAmountValid(d.dollars) ? d : null };
    savePending(sessionStorageOrNull(), PENDING_GIFT_KEY, p);
    finishIssue(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning]);

  // A reload after Stripe succeeded resumes issuing the card instead of a new payment.
  useEffect(() => {
    if (resumed.current || returning) return;
    resumed.current = true;
    const p = loadPending(sessionStorageOrNull(), PENDING_GIFT_KEY, isPendingGift<Draft | null>);
    if (p) {
      if (p.draft) {
        setDollars(p.draft.dollars);
        setDesign(giftDesign(p.draft.design));
        setName(p.draft.name);
        setEmail(p.draft.email);
        setMessage(p.draft.message);
      }
      finishIssue(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The PaymentIntent, once the pay step opens (again only if the gift it carries changed).
  useEffect(() => {
    if (step !== "pay" || returning || paid || !amountOk) return;
    const sig = JSON.stringify([dollars, design, name.trim(), email.trim(), message.trim()]);
    if (pi && piFor.current === sig) return;
    let cancelled = false;
    setPi(null);
    (async () => {
      const res = await api(`${SITE_API_URL}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "gift_card", amountCents: dollars! * 100, designId: design, recipientName: name.trim(), recipientEmail: email.trim(), personalMessage: message.trim() || undefined }),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      if (res?.ok && body?.clientSecret) {
        piFor.current = sig;
        setPi({ clientSecret: body.clientSecret, id: body.id });
      }
      else showAlert(te(giftErrorCode(toOrderApiError(body).code, res ? res.status : 0)));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, returning, paid, piNonce]);

  function next() {
    setTouched(true);
    if (step === "amount") {
      if (!amountOk) return showAlert(t("amounts.invalid", { min: money(GIFT_MIN_DOLLARS), max: money(GIFT_MAX_DOLLARS) }));
      showAlert(null);
      setTouched(false);
      setStep("recipient");
    } else if (step === "recipient") {
      if (!nameOk || !emailOk) return showAlert(tp("fixFields"));
      showAlert(null);
      setTouched(false);
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ dollars, design, name: name.trim(), email: email.trim(), message: message.trim() } satisfies Draft));
      } catch {
        /* storage blocked: a redirect return then relies on the webhook */
      }
      setStep("pay");
    }
    window.scrollTo({ top: 0 });
  }

  function back(to: Step) {
    showAlert(null);
    // The PaymentIntent is kept: coming back to pay with the same gift reuses it (see piFor).
    setStep(to);
  }

  // ------------------------------------------------------------ paid, finishing
  if (paid) {
    return (
      <PaymentReceived
        state={paidState}
        finishingText={tp("received.finishing")}
        stuckText={tp("received.stuck")}
        onRetry={paid.draft ? () => finishIssue(paid) : null}
      />
    );
  }

  // ------------------------------------------------------------ done
  if (step === "done" && issued) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 md:pt-14" data-gift-done>
        <Reveal from="scale" className="mx-auto max-w-sm">
          <GiftCardFace design={design} amount={issued.amountCents / 100} />
        </Reveal>
        <Reveal delay={80} className="mt-8">
          <Eyebrow locale={locale} as="p" className="m-0 text-oh-ember-light">
            {tp("done.eyebrow")}
          </Eyebrow>
          <Display locale={locale} className="m-0 mt-2 text-[clamp(2rem,7vw,3rem)] text-oh-cream">
            {tp("done.title")}
          </Display>
          <p className="m-0 mt-3 text-base text-oh-cream/85 [overflow-wrap:anywhere]">{tp("done.body", { amount: formatCents(issued.amountCents, locale), email: issued.recipientEmail || email })}</p>
        </Reveal>
        <Reveal delay={160} className="mt-6 rounded-3xl border border-dashed border-oh-stone bg-oh-ink px-5 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{tp("done.code")}</p>
          <p className="m-0 mt-1 break-all font-mono text-2xl tracking-[0.08em] text-oh-gold" data-gift-code>
            {issued.code}
          </p>
          <p className="m-0 mt-2 text-sm text-oh-mute">{tp("done.codeNote")}</p>
        </Reveal>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`/${locale}/gift-cards/purchase`} className={PRIMARY}>
            {tp("done.another")}
          </a>
          <Link href={`/${locale}`} className={SECONDARY}>
            {tp("done.home")}
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ steps
  const index = STEPS.indexOf(step as (typeof STEPS)[number]);
  const payable = step === "pay" && pi !== null;
  const cta = step === "pay" ? { label: tp("payCta", { amount: money(dollars || 0) }), type: "submit" as const, form: FORM_ID, busy: processing || !pi, data: "data-gift-pay" } : { label: tp("next"), onClick: next, busy: false, data: "data-gift-next" };

  return (
    <div data-gift-purchase data-gift-step={step} className="mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-10">
      <nav aria-label={tp("title")} className="mb-5">
        <p className="m-0 mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-oh-mute">
          {tp("stepOf", { current: index + 1, total: STEPS.length })}
          <span aria-hidden="true" className="px-2 text-oh-stone">
            /
          </span>
          <span className="text-oh-cream">{tp(`steps.${step as (typeof STEPS)[number]}`)}</span>
        </p>
        <ol className="m-0 flex list-none gap-1.5 p-0" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none ${i < index ? "bg-oh-ember-light/70" : i === index ? "bg-oh-ember-light" : "bg-oh-stone"}`} />
          ))}
        </ol>
      </nav>
      <Title locale={locale} as="h1" className="m-0 text-oh-cream">
        {tp("title")}
      </Title>

      <div className="mt-7 grid gap-6 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-10">
        <div className="md:sticky md:top-24">
          <GiftCardFace design={design} amount={amountOk ? dollars : null} className="mx-auto w-full max-w-md" />
          {step !== "amount" ? (
            <p className="m-0 mt-4 text-center text-[15px] text-oh-mute">
              {name.trim() ? tp("to", { name: name.trim() }) : null}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {step === "amount" ? (
            <>
              <section aria-labelledby={`${ids}-amt`} className={PANEL}>
                <h2 id={`${ids}-amt`} className={PANEL_TITLE}>
                  {t("amounts.title")}
                </h2>
                <div role="radiogroup" aria-label={t("amounts.presetsLabel")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {GIFT_PRESETS.map((d) => {
                    const on = !custom && dollars === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-amount={d}
                        onClick={() => {
                          setCustom("");
                          setDollars(d);
                        }}
                        className={`min-h-14 cursor-pointer appearance-none rounded-2xl border font-[inherit] text-lg font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${on ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream hover:border-oh-cream/60"}`}
                      >
                        {money(d)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5">
                  <label htmlFor={`${ids}-custom`} className={LABEL}>
                    {t("amounts.customLabel")}
                  </label>
                  <input
                    id={`${ids}-custom`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={custom}
                    maxLength={4}
                    aria-invalid={custom && !giftAmountValid(customDollars) ? true : undefined}
                    aria-describedby={`${ids}-custom-hint`}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setCustom(v);
                      setDollars(v ? parseGiftDollars(v) : 50);
                    }}
                    className={`${FIELD} tabular-nums`}
                    data-field="customAmount"
                  />
                  <p id={`${ids}-custom-hint`} className={`m-0 mt-1.5 text-sm ${custom && !giftAmountValid(customDollars) ? "text-oh-ember-light" : "text-oh-mute"}`}>
                    {custom && !giftAmountValid(customDollars) ? t("amounts.invalid", { min: money(GIFT_MIN_DOLLARS), max: money(GIFT_MAX_DOLLARS) }) : t("amounts.customHint", { min: money(GIFT_MIN_DOLLARS), max: money(GIFT_MAX_DOLLARS) })}
                  </p>
                </div>
              </section>
              <section aria-labelledby={`${ids}-face`} className={PANEL}>
                <h2 id={`${ids}-face`} className={PANEL_TITLE}>
                  {t("designs.title")}
                </h2>
                <div role="radiogroup" aria-labelledby={`${ids}-face`} className="grid grid-cols-3 gap-2">
                  {GIFT_DESIGNS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={design === d}
                      data-design={d}
                      onClick={() => setDesign(d)}
                      className={`flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-2xl border px-2 font-[inherit] text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${design === d ? "border-oh-cream bg-oh-cream text-oh-charcoal" : "border-oh-stone bg-transparent text-oh-cream"}`}
                    >
                      <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full ring-1 ring-oh-cream/40 ${d === "classic" ? "bg-oh-linen" : d === "dark" ? "bg-oh-charcoal" : "bg-oh-gold"}`} />
                      <span className="truncate">{t(`designs.${d}`)}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {step === "recipient" ? (
            <section aria-labelledby={`${ids}-who`} className={PANEL}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id={`${ids}-who`} className={`${PANEL_TITLE} mb-0`}>
                  {tp("recipientTitle")}
                </h2>
                <button type="button" onClick={() => back("amount")} className={TEXT_LINK}>
                  {tp("editAmount", { amount: money(dollars || 0) })}
                </button>
              </div>
              <div className="grid gap-4">
                <div>
                  <label htmlFor={`${ids}-name`} className={LABEL}>
                    {tp("recipientName")}
                  </label>
                  <input id={`${ids}-name`} value={name} maxLength={120} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-invalid={touched && !nameOk ? true : undefined} aria-describedby={touched && !nameOk ? `${ids}-name-err` : undefined} className={FIELD} data-field="recipientName" />
                  {touched && !nameOk ? (
                    <p id={`${ids}-name-err`} className="m-0 mt-1.5 text-sm text-oh-ember-light">
                      {tp("required")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor={`${ids}-email`} className={LABEL}>
                    {tp("recipientEmail")}
                  </label>
                  <input id={`${ids}-email`} type="email" inputMode="email" autoComplete="off" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !emailOk ? true : undefined} aria-describedby={`${ids}-email-hint`} className={FIELD} data-field="recipientEmail" />
                  <p id={`${ids}-email-hint`} className={`m-0 mt-1.5 text-sm ${touched && !emailOk ? "text-oh-ember-light" : "text-oh-mute"}`}>
                    {touched && !emailOk ? (email.trim() ? tp("invalidEmail") : tp("required")) : tp("recipientEmailHint")}
                  </p>
                </div>
                <div>
                  <label htmlFor={`${ids}-msg`} className={LABEL}>
                    {tp("message")}
                  </label>
                  <textarea id={`${ids}-msg`} value={message} maxLength={MESSAGE_MAX} rows={4} onChange={(e) => setMessage(e.target.value)} aria-describedby={`${ids}-msg-count`} className={`${FIELD} min-h-28 resize-y py-3 leading-relaxed`} data-field="message" />
                  <p id={`${ids}-msg-count`} className="m-0 mt-1.5 text-right text-sm tabular-nums text-oh-mute">
                    {tp("messageCount", { count: message.length, max: MESSAGE_MAX })}
                  </p>
                </div>
                <p className="m-0 flex items-center gap-2 text-sm text-oh-mute">
                  <Icon name="mail" size={16} className="shrink-0" />
                  {tp("deliveryNote")}
                </p>
              </div>
            </section>
          ) : null}

          {step === "pay" ? (
            <>
              <section aria-labelledby={`${ids}-sum`} className={PANEL} data-gift-summary>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 id={`${ids}-sum`} className={`${PANEL_TITLE} mb-0`}>
                    {tp("summaryTitle")}
                  </h2>
                  <button type="button" onClick={() => back("recipient")} disabled={processing} className={TEXT_LINK}>
                    {tp("edit")}
                  </button>
                </div>
                <dl className="m-0 flex flex-col gap-2">
                  <MoneyRow label={tp("giftCardFace", { face: t(`designs.${design}`) })} value={money(dollars || 0)} />
                  <MoneyRow label={tp("to", { name: name.trim() })} value={<span className="[overflow-wrap:anywhere]">{email.trim()}</span>} muted />
                  <MoneyRow label={tp("total")} value={<span data-total data-cents={(dollars || 0) * 100}>{money(dollars || 0)}</span>} strong className="mt-1 border-t border-oh-stone/70 pt-3" />
                </dl>
                <p className="m-0 mt-4 text-sm text-oh-mute" data-no-discounts>
                  {tp("noDiscounts")}
                </p>
              </section>
              <section aria-labelledby={`${ids}-pay`} className={PANEL}>
                <h2 id={`${ids}-pay`} className={PANEL_TITLE}>
                  <Icon name="wallet" size={16} />
                  {tp("payTitle")}
                </h2>
                {payable && pi ? (
                  <StripeProvider key={pi.clientSecret} clientSecret={pi.clientSecret} locale={stripeLocale(locale)} appearance={NIGHT_APPEARANCE} fonts={STRIPE_FONTS}>
                    <PaymentForm
                      amountCents={(dollars || 0) * 100}
                      formId={FORM_ID}
                      hideSubmit
                      tone="night"
                      showExpressCheckout
                      returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/gift-cards/purchase`}
                      onSuccess={(id) => paymentSucceeded(id)}
                      onError={(m) => showAlert(m || te("GENERIC"))}
                      onProcessingChange={setProcessing}
                      labels={{
                        submit: tp("payCta", { amount: money(dollars || 0) }),
                        processing: tp("processing"),
                        orPayWithCard: tp("orPayWithCard"),
                        savedCards: tp("savedCards"),
                        useNewCard: tp("useNewCard"),
                        cardEnding: (brand, last4) => tp("cardEnding", { brand, last4 }),
                        defaultBadge: tp("defaultCard"),
                        saveCard: tp("saveCard"),
                        failed: tp("failed"),
                        card: tp("cardGeneric"),
                      }}
                    />
                  </StripeProvider>
                ) : alert ? (
                  // The PaymentIntent couldn't be made: never spin forever, offer a fresh try.
                  <div className="flex min-h-32 items-center justify-center">
                    <button
                      type="button"
                      className={SECONDARY}
                      data-gift-pi-retry
                      onClick={() => {
                        showAlert(null);
                        piFor.current = null;
                        setPiNonce((n) => n + 1);
                      }}
                    >
                      {tp("retry")}
                    </button>
                  </div>
                ) : (
                  <div role="status" className="flex min-h-32 items-center justify-center gap-3 text-oh-mute">
                    <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
                    {tp("loading")}
                  </div>
                )}
                <p className="m-0 mt-4 flex items-center gap-2 text-sm text-oh-mute">
                  <Icon name="seal" size={16} className="shrink-0" />
                  {tp("secure")}
                </p>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-[var(--dock-h)] z-30 -mx-4 border-t border-oh-stone/70 bg-oh-charcoal/95 backdrop-blur-md md:-mx-8">
        {alert ? (
          <div className="mx-auto w-full max-w-5xl px-4 pt-3 md:px-8">
            <div ref={alertRef} tabIndex={-1} role="alert" data-gift-alert className="flex items-start gap-2.5 rounded-2xl bg-oh-ember-deep/25 px-3.5 py-2.5 text-[15px] leading-snug text-oh-cream outline-none">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
              <span className="min-w-0 flex-1">{alert}</span>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 md:px-8">
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="text-xs text-oh-mute">{tp("total")}</span>
            <span className="text-lg font-semibold tabular-nums text-oh-cream" aria-live="polite">
              {amountOk ? money(dollars!) : "--"}
            </span>
          </div>
          <button
            type={cta.type ?? "button"}
            form={"form" in cta ? cta.form : undefined}
            onClick={"onClick" in cta ? cta.onClick : undefined}
            disabled={cta.busy}
            aria-busy={cta.busy ? "true" : "false"}
            {...{ [cta.data]: "" }}
            className={`${PRIMARY} h-14 min-w-0 flex-1`}
          >
            {cta.busy && step === "pay" && (processing || returning) ? <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : null}
            <span className="truncate">{cta.label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
