"use client";

/**
 * The pay step (Task D5), on /{locale}/order/payment?orderId=...: the pod the
 * order holds, the server's totals, and Stripe (Express Checkout plus the
 * Payment Element, in the visitor's language). Also the page other flows
 * send an existing unpaid order to (the group lobby, add-on orders).
 *
 * Payment status is the server's alone: after Stripe confirms, the page
 * calls POST /orders/:id/confirm-payment with the PaymentIntent id, and the
 * API verifies it (succeeded, exact amount, metadata.orderId) before PAID.
 * A zero balance confirms with no PaymentIntent (server-verified). A 3DS
 * redirect returns here (the return URL keeps the locale) and is confirmed
 * the same way.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { StripeProvider, PaymentForm, type SavedPaymentMethod } from "@/components/payments";
import { Icon } from "@/components/site/icons/Icon";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { SITE_IMAGES } from "@/lib/site/images";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { confirmPayment, groupIdentityHeaders, paymentIntent, type PaymentIntentResult } from "@/lib/site/orders";
import { clearDraft } from "@/lib/site/order-draft";
import { formatCents, orderErrorCode, stripeLocale } from "@/lib/site/order-flow";
import { podWalkSteps } from "@/lib/site/pod-walk";
import { useGuest } from "@/contexts/guest-context";
import { StepSheet, TotalSummary, Spinner } from "./StepSheet";
import { Receipt, type ReceiptLine, type ReceiptTotals } from "./Receipt";
import { SignInGate } from "./SignInGate";
import { useOrderDraft } from "./useOrderDraft";
import "./order.css";

const FORM_ID = "oh-pay-form";

type OrderView = {
  id: string;
  orderNumber: string;
  orderQrCode?: string | null;
  paymentStatus?: string;
  status?: string;
  podSelectionMethod?: string | null;
  seat?: { label?: string | null; number?: string | null } | null;
  location?: { layoutKey?: string | null; name?: string | null } | null;
  items?: { id: string; quantity: number; priceCents: number; selectedValue?: string | null; menuItem: { id: string; name: string; categoryType?: string; category?: string; basePriceCents?: number } }[];
  userId?: string | null;
};

// The Payment Element in the night palette (Stripe needs literal colors, not CSS variables).
const NIGHT_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#E07A5A",
    colorBackground: "#1C1B19",
    colorText: "#F2EDE4",
    colorTextSecondary: "#9A9188",
    colorTextPlaceholder: "#8A8178",
    colorDanger: "#E07A5A",
    borderRadius: "14px",
    fontFamily: "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #3A3632", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #F2EDE4", boxShadow: "none" },
    ".Tab": { border: "1px solid #3A3632", backgroundColor: "#2A2724" },
    ".Tab--selected": { borderColor: "#E07A5A", backgroundColor: "#3A3632" },
    ".Label": { color: "#F2EDE4", fontWeight: "600" },
  },
};
const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&display=swap" }];

export function PayStep({ orderId, orderNumber }: { orderId: string | null; orderNumber: string | null }) {
  const t = useTranslations("orderFlow.pay");
  const tf = useTranslations("orderFlow");
  const te = useTranslations("orderFlow.errors");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const api = useSiteApi();
  const member = useMemberId();
  const { guest } = useGuest();
  const { draft, update } = useOrderDraft();
  // In-flight guard for confirming a payment (a second tap does nothing).
  const confirming = useRef(false);
  const money = useCallback((c: number) => formatCents(c, locale), [locale]);
  const identity = useMemo(() => (member.signedIn ? {} : groupIdentityHeaders(guest)), [member.signedIn, guest]);

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [pi, setPi] = useState<PaymentIntentResult | null>(null);
  const [error, setError] = useState<{ text: string; retry?: boolean; restart?: boolean } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [saved, setSaved] = useState<SavedPaymentMethod[]>([]);
  const [customerReady, setCustomerReady] = useState(false);
  const returning = search.get("payment_intent");
  const done = useRef(false);

  const statusHref = useCallback((qr: string | null | undefined) => (qr ? `/${locale}/order/status?orderQrCode=${encodeURIComponent(qr)}` : `/${locale}/order/confirmation?orderId=${encodeURIComponent(orderId || "")}&orderNumber=${encodeURIComponent(orderNumber || "")}&paid=true`), [locale, orderId, orderNumber]);

  const finish = useCallback(
    (qr: string | null | undefined) => {
      done.current = true;
      try {
        if (qr) localStorage.setItem("activeOrderQrCode", qr);
      } catch {
        /* storage blocked */
      }
      try {
        clearDraft(window.sessionStorage);
      } catch {
        /* ignore */
      }
      router.replace(statusHref(qr));
    },
    [router, statusHref],
  );

  const canAct = member.ready && (member.signedIn || Boolean(guest));

  // The order: its pod, lines and QR code (owner view).
  useEffect(() => {
    if (!orderId || !canAct) return;
    let cancelled = false;
    (async () => {
      const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}?locale=${locale}`, { headers: identity }).catch(() => null);
      const body = res && res.ok ? ((await res.json().catch(() => null)) as OrderView | null) : null;
      if (cancelled) return;
      if (!body) {
        update((d) => (d.order?.id === orderId ? { ...d, order: null } : d));
        setLoadState("missing");
        return;
      }
      setOrder(body);
      setLoadState("ready");
      if (body.paymentStatus === "PAID" && !done.current) finish(body.orderQrCode);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, canAct, locale]);

  // A member's Stripe customer (so "Save this card" can attach) and saved cards.
  useEffect(() => {
    if (!member.ready) return;
    if (!member.signedIn || !member.userId) {
      setCustomerReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const id = encodeURIComponent(member.userId!);
      const customer = await api(`${SITE_API_URL}/users/${id}/stripe-customer`, { method: "POST" }).catch(() => null);
      if (customer?.ok) {
        const methods = await api(`${SITE_API_URL}/users/${id}/payment-methods`).catch(() => null);
        const list = methods?.ok ? await methods.json().catch(() => []) : [];
        if (!cancelled && Array.isArray(list)) setSaved(list);
      }
      if (!cancelled) setCustomerReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, member.signedIn, member.userId]);

  // The PaymentIntent for exactly what the server says is due (again when "Save this card" changes).
  const loadIntent = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    const res = await paymentIntent(orderId, { savePaymentMethod: saveCard }, { fetcher: api, baseUrl: SITE_API_URL, headers: identity });
    if (!res.ok) {
      const code = orderErrorCode(res.error.code, res.status);
      if (code === "ALREADY_PAID") {
        finish(order?.orderQrCode);
        return;
      }
      if (code === "ORDER_CANCELLED" || code === "ORDER_NOT_FOUND" || code === "LEGACY_ORDER") {
        // This order can't be paid any more: drop it from the draft so the flow makes a fresh one.
        update((d) => (d.order?.id === orderId ? { ...d, order: null } : d));
        setError({ text: te(code), restart: true });
        return;
      }
      setError({ text: te(code), retry: code === "GENERIC" || code === "NETWORK_ERROR" || code === "PAYMENTS_UNAVAILABLE" || code === "RATE_LIMITED" });
      return;
    }
    setPi(res.data);
  }, [orderId, saveCard, api, identity, finish, order?.orderQrCode, te, update]);

  useEffect(() => {
    if (!canAct || !customerReady || loadState !== "ready" || returning || done.current) return;
    if (order?.paymentStatus === "PAID") return;
    loadIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct, customerReady, loadState, saveCard, returning]);

  // Back from a 3DS or wallet redirect: the server verifies the PaymentIntent.
  useEffect(() => {
    if (!returning || !orderId || !canAct || done.current) return;
    (async () => {
      setProcessing(true);
      const res = await confirmPayment(orderId, returning, { fetcher: api, baseUrl: SITE_API_URL, headers: identity });
      if (res.ok) finish((res.data.orderQrCode as string | undefined) ?? order?.orderQrCode);
      else {
        setProcessing(false);
        setError({ text: res.error.refunded ? `${te(orderErrorCode(res.error.code, res.status))} ${t("refunded")}` : te(orderErrorCode(res.error.code, res.status)), retry: true });
        router.replace(`/${locale}/order/payment?orderId=${encodeURIComponent(orderId)}&orderNumber=${encodeURIComponent(orderNumber || "")}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning, orderId, canAct]);

  async function confirmPaid(paymentIntentId: string | null) {
    if (!orderId || confirming.current) return;
    confirming.current = true;
    try {
      await confirmPaidOnce(paymentIntentId);
    } finally {
      confirming.current = false;
    }
  }

  async function confirmPaidOnce(paymentIntentId: string | null) {
    if (!orderId) return;
    setProcessing(true);
    setError(null);
    const res = await confirmPayment(orderId, paymentIntentId, { fetcher: api, baseUrl: SITE_API_URL, headers: identity });
    if (res.ok) {
      finish((res.data.orderQrCode as string | undefined) ?? order?.orderQrCode);
      return;
    }
    setProcessing(false);
    const code = orderErrorCode(res.error.code, res.status);
    setError({ text: res.error.refunded ? `${te(code)} ${t("refunded")}` : te(code), retry: true });
    // A refunded or refused charge needs a fresh PaymentIntent before another try.
    loadIntent();
  }

  // ------------------------------------------------------------ render
  // Back to savings when this order came from the draft on this tab; otherwise to the start.
  const backHref = draft.locationId && draft.order?.id === orderId ? `/${locale}/order/location/${encodeURIComponent(draft.locationId)}?step=savings` : `/${locale}/order`;
  if (!orderId) return <Missing />;
  if (member.ready && !member.signedIn && !guest) {
    return (
      <StepSheet step="pay" title={t("title")} backHref={backHref}>
        <SignInGate returnTo={`/${locale}/order/payment?orderId=${encodeURIComponent(orderId)}&orderNumber=${encodeURIComponent(orderNumber || "")}`} />
      </StepSheet>
    );
  }
  if (loadState === "missing") return <Missing restartHref={draft.locationId ? `/${locale}/order/location/${encodeURIComponent(draft.locationId)}?step=arrival` : null} />;

  const totals: ReceiptTotals | null = pi
    ? {
        subtotalCents: pi.totals.subtotalCents,
        rewardCents: pi.totals.rewardDiscountCents || 0,
        promoCents: pi.totals.promoDiscountCents || 0,
        taxCents: pi.totals.taxCents,
        totalCents: pi.totals.totalCents,
        creditsCents: pi.totals.creditsAppliedCents || 0,
        giftCardCents: pi.totals.giftCardAppliedCents || 0,
        mealGiftCents: pi.totals.mealGiftAppliedCents || 0,
        amountDueCents: pi.totals.amountDueCents,
      }
    : null;
  const due = pi ? pi.amountDueCents : null;
  const free = due === 0;
  const label = order?.seat?.label || order?.seat?.number || null;
  const steps = podWalkSteps(order?.location?.layoutKey, label);
  const lines = order ? receiptFromOrder(order, totals?.rewardCents || 0) : [];

  const cta = !pi
    ? { label: t("payCta", { amount: "" }).trim(), disabled: true, busy: !error }
    : free
      ? { label: t("free"), onClick: () => confirmPaid(null), busy: processing, dataAttr: "data-pay-free" }
      : { label: t("payCta", { amount: money(due!) }), type: "submit" as const, form: FORM_ID, busy: processing, dataAttr: "data-pay-submit" };

  return (
    <StepSheet
      step="pay"
      title={t("title")}
      lede={orderNumber ? t("lede", { number: orderNumber.slice(-6) }) : undefined}
      backHref={backHref}
      wide
      alert={
        error ? (
          <>
            {error.text}
            {error.restart ? (
              <>
                {" "}
                <a
                  href={draft.locationId ? `/${locale}/order/location/${encodeURIComponent(draft.locationId)}?step=arrival` : `/${locale}/order`}
                  className="font-semibold text-oh-cream underline underline-offset-4"
                >
                  {t("restart")}
                </a>
              </>
            ) : null}
            {error.retry ? (
              <>
                {" "}
                <button type="button" onClick={loadIntent} className="min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[15px] font-semibold text-oh-cream underline underline-offset-4">
                  {t("retry")}
                </button>
              </>
            ) : null}
          </>
        ) : null
      }
      summary={<TotalSummary label={tf("due")} cents={due} format={money} />}
      cta={cta}
    >
      <div className="oh-step-in grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-5">
          {/* The pod this order holds */}
          <section aria-labelledby="pay-pod" className="overflow-hidden rounded-3xl bg-oh-ink">
            <div className="relative aspect-[16/7] w-full bg-oh-linen [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              <SitePicture image="pod-hatch-b" sizes="(min-width: 768px) 560px, 100vw" alt={tRoot(SITE_IMAGES["pod-hatch-b"].alt)} className="block h-full w-full" />
            </div>
            <div className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream">
                <Icon name="pod" size={24} />
              </span>
              <div className="flex min-w-0 flex-col">
                <h2 id="pay-pod" className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
                  {t("podTitle")}
                </h2>
                {loadState !== "ready" ? (
                  <span className="mt-1 inline-block h-6 w-32 animate-pulse rounded bg-oh-stone motion-reduce:animate-none" />
                ) : label ? (
                  <p data-pod-label className="m-0 text-xl font-semibold text-oh-cream">
                    {t("podLabel", { label })}
                    <span className="block text-sm font-normal text-oh-mute">{steps ? t("podSteps", { steps }) : t("podNearest")}</span>
                  </p>
                ) : (
                  <p className="m-0 text-[15px] text-oh-cream">{t("podLater")}</p>
                )}
              </div>
            </div>
          </section>
          <Receipt lines={lines} totals={totals} />
        </div>

        <section aria-labelledby="pay-card" className="rounded-3xl bg-oh-ink p-4 md:p-5">
          <h2 id="pay-card" className="m-0 mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
            <Icon name="wallet" size={16} />
            {free ? t("freeTitle") : t("cardTitle")}
          </h2>
          {!pi ? (
            <div role="status" className="flex min-h-40 items-center justify-center gap-3 text-oh-mute">
              {error ? null : (
                <>
                  <Spinner />
                  <span>{tf("loading")}</span>
                </>
              )}
            </div>
          ) : free ? (
            <p className="m-0 text-[15px] leading-relaxed text-oh-cream">{t("freeNote")}</p>
          ) : pi.clientSecret ? (
            <StripeProvider key={pi.clientSecret} clientSecret={pi.clientSecret} locale={stripeLocale(locale)} appearance={NIGHT_APPEARANCE} fonts={STRIPE_FONTS}>
              <PaymentForm
                amountCents={due!}
                formId={FORM_ID}
                hideSubmit
                tone="night"
                showExpressCheckout
                showSaveCard={Boolean(member.signedIn && member.userId && order?.userId === member.userId)}
                saveCard={saveCard}
                onSaveCardChange={setSaveCard}
                savedPaymentMethods={saved}
                returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/order/payment?orderId=${encodeURIComponent(orderId)}&orderNumber=${encodeURIComponent(orderNumber || "")}`}
                onSuccess={(id) => confirmPaid(id)}
                onError={(message) => setError({ text: message || te("GENERIC") })}
                onProcessingChange={setProcessing}
                labels={{
                  submit: t("payCta", { amount: money(due!) }),
                  processing: t("processing"),
                  orPayWithCard: t("orPayWithCard"),
                  savedCards: t("savedCards"),
                  useNewCard: t("useNewCard"),
                  cardEnding: (brand, last4) => t("cardEnding", { brand, last4 }),
                  defaultBadge: t("defaultCard"),
                  saveCard: t("saveCard"),
                  failed: t("failed"),
                  card: t("cardGeneric"),
                }}
              />
            </StripeProvider>
          ) : null}
          <p className="m-0 mt-4 flex items-center gap-2 text-sm text-oh-mute">
            <Icon name="seal" size={16} />
            {t("secure")}
          </p>
        </section>
      </div>
    </StepSheet>
  );
}

function Missing({ restartHref = null }: { restartHref?: string | null }) {
  const t = useTranslations("orderFlow.pay");
  const locale = useLocale();
  return (
    <StepSheet step="pay" title={t("missingTitle")} backHref={`/${locale}/order`}>
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-oh-ink p-5">
        <p className="m-0 text-[15px] text-oh-mute">{t("missingBody")}</p>
        <a href={restartHref || `/${locale}/order`} className="inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline">
          {restartHref ? t("restart") : t("startOver")}
        </a>
      </div>
    </StepSheet>
  );
}

/** Receipt lines from a stored order (localized names; sliders are free and not listed). */
function receiptFromOrder(order: OrderView, rewardCents: number): ReceiptLine[] {
  const items = order.items || [];
  const kind = (i: NonNullable<OrderView["items"]>[number]) => {
    const ct = i.menuItem.categoryType || "";
    const cat = i.menuItem.category || "";
    if (ct === "SLIDER" || cat.startsWith("slider")) return "slider";
    if (ct === "MAIN" || cat.startsWith("main")) return (i.menuItem.basePriceCents || 0) > 0 ? "soup" : "noodles";
    return "extra";
  };
  const noodles = items.find((i) => kind(i) === "noodles");
  const shown = items.filter((i) => kind(i) === "soup" || (kind(i) === "extra" && i.quantity > 0));
  shown.sort((a, b) => Number(kind(b) === "soup") - Number(kind(a) === "soup"));
  const rewarded = rewardCents > 0 ? shown.find((i) => (i.menuItem.basePriceCents || 0) === rewardCents || i.priceCents === rewardCents) : undefined;
  return shown.map((i) => ({
    key: i.id,
    label: i.menuItem.name,
    detail: kind(i) === "soup" ? noodles?.menuItem.name ?? null : i.quantity > 1 ? `x${i.quantity}` : null,
    cents: i.priceCents,
    nowCents: rewarded === i ? Math.max(0, i.priceCents - rewardCents) : null,
    main: kind(i) === "soup",
  }));
}
