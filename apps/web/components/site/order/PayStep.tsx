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
 *
 * Final review C1: once Stripe says a PaymentIntent succeeded, the page
 * never shows Pay again and never asks for a new PaymentIntent for this
 * order. The id is kept in sessionStorage (lib/site/paid-recovery), the
 * confirm is retried with that SAME id (with backoff), and then "Payment
 * received" offers Retry and support. A reload or a 3DS return resumes it.
 * Only the server saying the charge was refunded (or the order changed)
 * lets the page fetch a fresh PaymentIntent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { StripeProvider, PaymentForm, type SavedPaymentMethod } from "@/components/payments";
import { Icon } from "@/components/site/icons/Icon";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { SITE_IMAGES } from "@/lib/site/images";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { confirmPayment, groupIdentityHeaders, paymentIntent, type PaymentIntentResult } from "@/lib/site/orders";
import { statusPath } from "@/lib/site/order-status";
import { clearDraft } from "@/lib/site/order-draft";
import { formatCents, orderErrorCode, stripeLocale } from "@/lib/site/order-flow";
import { useGuest } from "@/contexts/guest-context";
import { StepSheet, TotalSummary, Spinner } from "./StepSheet";
import { Receipt, type ReceiptLine, type ReceiptTotals } from "./Receipt";
import { SignInGate } from "./SignInGate";
import { useOrderDraft } from "./useOrderDraft";
import { NIGHT_APPEARANCE, STRIPE_FONTS } from "@/lib/site/stripe-night";
import { clearPending, ORDER_RECREATE_CODES, PENDING_ORDER_KEY, pendingOrderFor, settlePaid, type FinishResult, type PendingOrder } from "@/lib/site/paid-recovery";
import type { ReceivedState } from "@/components/site/store/PaymentReceived";
import "./order.css";

/** D12: the pod moved at payment (POST /orders/:id/confirm-payment returns it). */
type PodChange = { changed?: boolean; from?: string | null; to?: string | null; noPod?: boolean };

const FORM_ID = "oh-pay-form";

// The paid view loads only when a payment needs finishing (store D10's shared view).
const PaymentReceived = dynamic(() => import("@/components/site/store/PaymentReceived").then((m) => m.PaymentReceived), { ssr: false });

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

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


export function PayStep({ orderId, orderNumber }: { orderId: string | null; orderNumber: string | null }) {
  const t = useTranslations("orderFlow.pay");
  const tf = useTranslations("orderFlow");
  const te = useTranslations("orderFlow.errors");
  const tRoot = useTranslations();
  const tr = useTranslations("store.checkout.received");
  const tse = useTranslations("store.errors");
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
  const [error, setError] = useState<{ text: string; retry?: boolean; restart?: boolean; reload?: boolean } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [saved, setSaved] = useState<SavedPaymentMethod[]>([]);
  const [customerReady, setCustomerReady] = useState(false);
  const returning = search.get("payment_intent");
  const redirectStatus = search.get("redirect_status");
  const done = useRef(false);
  // C1: a PaymentIntent Stripe said succeeded, being confirmed (never paid again).
  const [paid, setPaid] = useState<PendingOrder | null>(null);
  const [paidState, setPaidState] = useState<ReceivedState>("finishing");
  // Why the page is paying again (a refunded charge, a declined 3DS): survives loadIntent clearing `error`.
  const [notice, setNotice] = useState<string | null>(null);
  const [returnHandled, setReturnHandled] = useState(false);
  const resumed = useRef(false);
  const payPath = `/${locale}/order/payment?orderId=${encodeURIComponent(orderId || "")}&orderNumber=${encodeURIComponent(orderNumber || "")}`;

  // Task D6: a pod that moved at payment (D12's podChange) rides along, so the next page says "Your pod is now B-07".
  const statusHref = useCallback(
    (qr: string | null | undefined, change?: PodChange | null) =>
      qr
        ? statusPath(locale, qr, change)
        : `/${locale}/order/confirmation?orderId=${encodeURIComponent(orderId || "")}&orderNumber=${encodeURIComponent(orderNumber || "")}&paid=true${change?.changed && change.from ? `&podFrom=${encodeURIComponent(change.from)}` : ""}`,
    [locale, orderId, orderNumber],
  );

  const finish = useCallback(
    (qr: string | null | undefined, change?: PodChange | null) => {
      done.current = true;
      if (pendingOrderFor(sessionStorageOrNull(), orderId)) clearPending(sessionStorageOrNull(), PENDING_ORDER_KEY);
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
      router.replace(statusHref(qr, change));
    },
    [router, statusHref, orderId],
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
      if (!body && (!res || res.status >= 500 || res.status === 429)) {
        // Couldn't reach the API: keep the order (it still holds the pod) and let the guest retry.
        setError({ text: te(res ? "RATE_LIMITED" : "NETWORK_ERROR"), reload: true });
        return;
      }
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
    // C1: a succeeded PaymentIntent is still being confirmed: never make another one.
    if (pendingOrderFor(sessionStorageOrNull(), orderId)) return;
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
    if (!canAct || !customerReady || loadState !== "ready" || (returning && !returnHandled) || done.current || paid) return;
    if (order?.paymentStatus === "PAID") return;
    loadIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct, customerReady, loadState, saveCard, returning, returnHandled, paid]);

  /**
   * C1: Stripe said this PaymentIntent succeeded. Confirm it with the same id
   * (retried with backoff); "done" goes on, "stuck" and "review" stay on
   * Payment received (Retry, support), and only a refunded charge or a
   * changed order drops it and lets the page pay again.
   */
  const finishPaid = useCallback(
    async (p: PendingOrder) => {
      if (confirming.current || done.current) return;
      confirming.current = true;
      setPaid(p);
      setPaidState("finishing");
      setError(null);
      setNotice(null);
      try {
        const { outcome, result: res } = await settlePaid(
          sessionStorageOrNull(),
          PENDING_ORDER_KEY,
          p,
          () => confirmPayment(p.orderId, p.paymentIntentId, { fetcher: api, baseUrl: SITE_API_URL, headers: identity }) as Promise<Awaited<ReturnType<typeof confirmPayment>> & FinishResult>,
          ORDER_RECREATE_CODES,
        );
        if (outcome === "done") {
          finish((res.data?.orderQrCode as string | undefined) ?? order?.orderQrCode, (res.data as { podChange?: PodChange } | null)?.podChange);
          return;
        }
        if (outcome === "stuck" || outcome === "review") {
          setPaidState(outcome);
          return;
        }
        // reprice: the server refunded the charge (or the order changed). Pay again, or start over.
        const code = orderErrorCode(res.error.code, res.status);
        const text = res.error.refunded ? `${te(code)} ${t("refunded")}` : te(code);
        setPi(null);
        if (code === "ORDER_CANCELLED" || code === "ORDER_NOT_FOUND" || code === "LEGACY_ORDER") {
          update((d) => (d.order?.id === p.orderId ? { ...d, order: null } : d));
          setError({ text, restart: true });
        } else {
          // The intent effect fetches a fresh PaymentIntent once `paid` is cleared.
          setNotice(text);
        }
        setReturnHandled(true);
        if (returning) router.replace(payPath);
        setPaid(null);
      } finally {
        confirming.current = false;
      }
    },
    [api, identity, finish, order?.orderQrCode, te, t, update, returning, router, payPath],
  );

  const paymentSucceeded = useCallback(
    (paymentIntentId: string) => {
      if (!orderId) return;
      void finishPaid({ orderId, paymentIntentId });
    },
    [orderId, finishPaid],
  );

  // A reload after Stripe succeeded resumes the confirm (same PaymentIntent) instead of paying again.
  useEffect(() => {
    if (!orderId || !canAct || resumed.current || returning) return;
    resumed.current = true;
    const p = pendingOrderFor(sessionStorageOrNull(), orderId);
    if (p) void finishPaid(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, canAct, returning]);

  // Back from a 3DS or wallet redirect: confirm THAT PaymentIntent (the server verifies it with Stripe).
  useEffect(() => {
    if (!returning || !orderId || !canAct || done.current || resumed.current) return;
    resumed.current = true;
    // A PaymentIntent that already succeeded here comes first (the URL may still name an older one).
    const pending = pendingOrderFor(sessionStorageOrNull(), orderId);
    if (pending) {
      setReturnHandled(true);
      void finishPaid(pending);
      return;
    }
    if (redirectStatus === "failed" || redirectStatus === "requires_payment_method" || redirectStatus === "canceled") {
      // Not charged: say so and pay again (a fresh PaymentIntent is safe here).
      setNotice(t("failed"));
      setReturnHandled(true);
      router.replace(payPath);
      return;
    }
    setReturnHandled(true);
    paymentSucceeded(returning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning, orderId, canAct]);

  /** A zero balance: confirm with no PaymentIntent (nothing was charged, so a fresh try is safe). */
  async function confirmFree() {
    if (!orderId || confirming.current) return;
    confirming.current = true;
    try {
      await confirmFreeOnce();
    } finally {
      confirming.current = false;
    }
  }

  async function confirmFreeOnce() {
    if (!orderId) return;
    setProcessing(true);
    setError(null);
    const res = await confirmPayment(orderId, null, { fetcher: api, baseUrl: SITE_API_URL, headers: identity });
    if (res.ok) {
      finish((res.data.orderQrCode as string | undefined) ?? order?.orderQrCode, (res.data as { podChange?: PodChange }).podChange);
      return;
    }
    setProcessing(false);
    const code = orderErrorCode(res.error.code, res.status);
    setError({ text: te(code), retry: true });
    // The total may have changed: fetch what is due now.
    loadIntent();
  }

  // ------------------------------------------------------------ render
  // Back to savings when this order came from the draft on this tab; otherwise to the start.
  const backHref = draft.locationId && draft.order?.id === orderId ? `/${locale}/order/location/${encodeURIComponent(draft.locationId)}?step=savings` : `/${locale}/order`;
  // Task G2b: the floor-plan geometry (and the plan model behind it) loads
  // after the page, just for the walk line; it reads "nearest the entrance"
  // until then (the same as an unknown pod). Above the early returns: a hook.
  const walkLayout = order?.location?.layoutKey;
  const walkLabel = order?.seat?.label || order?.seat?.number || null;
  const [steps, setSteps] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    import("@/lib/site/pod-walk").then((m) => {
      if (live) setSteps(m.podWalkSteps(walkLayout, walkLabel));
    });
    return () => {
      live = false;
    };
  }, [walkLayout, walkLabel]);

  if (!orderId) return <Missing />;
  if (member.ready && !member.signedIn && !guest) {
    return (
      <StepSheet step="pay" title={t("title")} backHref={backHref}>
        <SignInGate returnTo={`/${locale}/order/payment?orderId=${encodeURIComponent(orderId)}&orderNumber=${encodeURIComponent(orderNumber || "")}`} />
      </StepSheet>
    );
  }
  if (paid) {
    return (
      <PaymentReceived
        state={paidState}
        finishingText={tr("finishing")}
        stuckText={tr("stuck")}
        reviewText={tse("NEEDS_REVIEW")}
        reference={orderNumber ? { label: tr("number"), value: orderNumber.slice(-6) } : null}
        onRetry={() => void finishPaid(paid)}
      />
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

  const lines = order ? receiptFromOrder(order, totals?.rewardCents || 0) : [];

  const cta = !pi
    ? { label: t("payCta", { amount: "" }).trim(), disabled: true, busy: !error }
    : free
      ? { label: t("free"), onClick: () => confirmFree(), busy: processing, dataAttr: "data-pay-free" }
      : { label: t("payCta", { amount: money(due!) }), type: "submit" as const, form: FORM_ID, busy: processing, dataAttr: "data-pay-submit" };

  return (
    <StepSheet
      step="pay"
      title={t("title")}
      lede={orderNumber ? t("lede", { number: orderNumber.slice(-6) }) : undefined}
      backHref={backHref}
      wide
      alert={
        !error && notice ? (
          notice
        ) : error ? (
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
            {error.reload ? (
              <>
                {" "}
                <button type="button" onClick={() => window.location.reload()} className="min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[15px] font-semibold text-oh-cream underline underline-offset-4">
                  {t("retry")}
                </button>
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
                onSuccess={(id) => paymentSucceeded(id)}
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
