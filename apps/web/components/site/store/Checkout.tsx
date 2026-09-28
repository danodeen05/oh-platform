"use client";

/**
 * Store checkout (Task D10, /store/checkout), on the server-priced shop API
 * from Task D10a:
 *
 *  1. The visitor fills in how they get it (ship or pick up), contact and
 *     address, and optional savings (member credit, a gift card code). The
 *     page shows only the bag's item total; no client shipping or tax.
 *  2. "Review order" creates the order (POST /shop/orders). The owner is the
 *     Clerk member, or a guest session started here. The server prices it:
 *     shipping, tax, the savings it RECORDS (nothing is spent yet) and the
 *     total. A zero total comes back PAID (server-verified zero balance).
 *  3. The PaymentIntent is for exactly the order's amount due (the client
 *     never sends an amount). After Stripe succeeds, POST
 *     /shop/orders/:id/confirm-payment verifies it and spends the savings
 *     in one transaction.
 *  4. If the savings or stock changed meanwhile, confirm answers 409
 *     CREDIT_SHORT / GIFT_CARD_CHANGED / OUT_OF_STOCK AFTER refunding the
 *     charge in full. The page says so calmly ("You were not charged ..."),
 *     drops the order, and the next "Review order" re-creates it, so the
 *     server prices it again with what is left.
 *
 * A 3DS or wallet redirect returns to the confirmation page, which confirms
 * the same way (store/confirmation).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SignInTrigger } from "@/components/site/auth/AuthTriggers";
import { useSiteAuth } from "@/lib/site/auth";
import type { SavedPaymentMethod } from "@/components/payments";
import dynamic from "next/dynamic";

// Task G2b: Stripe loads at the pay step, not with the page (the first screen
// is a form). Both chunks are fetched when the payment section mounts.
const StripeProvider = dynamic(() => import("@/components/payments/StripeProvider").then((m) => m.StripeProvider), { ssr: false });
const PaymentForm = dynamic(() => import("@/components/payments/PaymentForm").then((m) => m.PaymentForm), { ssr: false });
import { useCart } from "@/contexts/cart-context";
import { useGuest } from "@/contexts/guest-context";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Title } from "@/components/site/Text";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { formatCents, stripeLocale } from "@/lib/site/order-flow";
import { createShopOrder, shopConfirmPayment, shopPaymentIntent, type ShopOrder } from "@/lib/site/orders";
import { NIGHT_APPEARANCE, STRIPE_FONTS } from "@/lib/site/stripe-night";
import { clearPending, finishWithRetry, isPendingShop, loadPending, PENDING_SHOP_KEY, savePending, shopFinishOutcome, type PendingShop } from "@/lib/site/paid-recovery";
import { FREE_SHIPPING_MIN_CENTS, formatGiftCode, giftCodeComplete, localizeProduct, productImage, RECREATE_CODES, storeErrorCode } from "@/lib/site/store";
import { useShopCatalog } from "./CartView";
import { PaymentReceived, type ReceivedState } from "./PaymentReceived";
import { FIELD, LABEL, MoneyRow, PANEL, PANEL_TITLE, PRIMARY, ProductPhoto, TEXT_LINK } from "./ui";

const FORM_ID = "oh-store-pay-form";
const PENDING_GIFT_KEY = "pendingGiftCardCode";

type Fulfillment = "SHIPPING" | "IN_STORE_PICKUP";
type Fields = { name: string; email: string; address1: string; address2: string; city: string; state: string; zip: string };
type Location = { id: string; name: string };
type Alert = { text: string; tone: "error" | "calm" };

const EMPTY: Fields = { name: "", email: "", address1: "", address2: "", city: "", state: "", zip: "" };

export function Checkout({ initialFulfillment = "SHIPPING" }: { initialFulfillment?: Fulfillment }) {
  const t = useTranslations("store.checkout");
  const te = useTranslations("store.errors");
  const tn = useTranslations("store.notCharged");
  const locale = useLocale();
  const router = useRouter();
  const api = useSiteApi();
  const member = useMemberId();
  const auth = useSiteAuth();
  const { guest, startGuestSession, isLoading: guestLoading } = useGuest();
  const { items, subtotalCents, clearCart } = useCart();
  const catalog = useShopCatalog();
  const ids = useId();
  const alertRef = useRef<HTMLDivElement>(null);
  usePublishOrderBack(`/${locale}/store/cart`, t("back"));
  const money = useCallback((c: number) => formatCents(c, locale), [locale]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [fulfillment, setFulfillment] = useState<Fulfillment>(initialFulfillment);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [touched, setTouched] = useState(false);

  const [credits, setCredits] = useState<number | null>(null);
  const [useCredits, setUseCredits] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [card, setCard] = useState<{ code: string; balanceCents: number } | null>(null);
  const [cardState, setCardState] = useState<"idle" | "checking" | "invalid">("idle");

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [pi, setPi] = useState<{ clientSecret: string; amountCents: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [saved, setSaved] = useState<SavedPaymentMethod[]>([]);
  const finishing = useRef(false);
  const confirming = useRef(false);
  // Fix round 1: once Stripe says the payment succeeded, the page only finishes it (never Pay again).
  const [paid, setPaid] = useState<PendingShop | null>(null);
  const [paidState, setPaidState] = useState<ReceivedState>("finishing");
  const resumed = useRef(false);

  // Prefill from the member's account.
  useEffect(() => {
    if (!auth.isSignedIn || (!auth.name && !auth.email)) return;
    setFields((f) => ({
      ...f,
      name: f.name || auth.name || "",
      email: f.email || auth.email || "",
    }));
  }, [auth.isSignedIn, auth.name, auth.email]);

  // The member's credit (GET /users/:id/profile) and saved cards.
  useEffect(() => {
    if (!member.ready || !member.userId) return;
    let cancelled = false;
    const id = encodeURIComponent(member.userId);
    (async () => {
      const profile = await api(`${SITE_API_URL}/users/${id}/profile?locale=${locale}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!cancelled) setCredits(typeof profile?.membership?.credits === "number" ? profile.membership.credits : 0);
      const customer = await api(`${SITE_API_URL}/users/${id}/stripe-customer`, { method: "POST" }).catch(() => null);
      if (customer?.ok) {
        const list = await api(`${SITE_API_URL}/users/${id}/payment-methods`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
        if (!cancelled && Array.isArray(list)) setSaved(list);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, member.userId]);

  // Restaurants for pickup (their own translations).
  useEffect(() => {
    let cancelled = false;
    fetch(`${SITE_API_URL}/locations`, { headers: { "x-tenant-slug": "oh" } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((rows: { id: string; name: string; isClosed?: boolean; i18n?: Record<string, { name?: string }> | null }[]) => {
        if (cancelled || !Array.isArray(rows)) return;
        const list = rows.filter((l) => !l.isClosed).map((l) => ({ id: l.id, name: l.i18n?.[locale]?.name || l.i18n?.en?.name || l.name }));
        setLocations(list);
        setLocationId((cur) => cur || list[0]?.id || "");
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // A code handed over from the balance page.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(PENDING_GIFT_KEY);
      localStorage.removeItem(PENDING_GIFT_KEY);
    } catch {
      pending = null;
    }
    if (pending) {
      const code = formatGiftCode(pending);
      setCodeInput(code);
      if (giftCodeComplete(code)) checkCard(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAlert = useCallback((a: Alert | null) => {
    setAlert(a);
    if (a) requestAnimationFrame(() => alertRef.current?.focus());
  }, []);

  async function checkCard(code: string) {
    setCardState("checking");
    const res = await fetch(`${SITE_API_URL}/gift-cards/code/${encodeURIComponent(code)}`).catch(() => null);
    const body = res && res.ok ? await res.json().catch(() => null) : null;
    if (body && typeof body.balanceCents === "number" && body.balanceCents > 0) {
      setCard({ code, balanceCents: body.balanceCents });
      setCardState("idle");
    } else {
      setCard(null);
      setCardState("invalid");
    }
  }

  // ------------------------------------------------------------ validation
  const shipping = fulfillment === "SHIPPING";
  const problems = useMemo(() => {
    const p: Partial<Record<keyof Fields | "location", string>> = {};
    if (!fields.name.trim()) p.name = t("required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) p.email = fields.email.trim() ? t("invalidEmail") : t("required");
    if (shipping) {
      if (!fields.address1.trim()) p.address1 = t("required");
      if (!fields.city.trim()) p.city = t("required");
      if (!fields.state.trim()) p.state = t("required");
      if (!/^\d{5}(-\d{4})?$/.test(fields.zip.trim())) p.zip = fields.zip.trim() ? t("invalidZip") : t("required");
    } else if (!locationId) p.location = t("required");
    return p;
  }, [fields, shipping, locationId, t]);

  const locked = order !== null;

  // ------------------------------------------------------------ actions
  const shopCall = useCallback(
    (token?: string | null) => ({ fetcher: api, baseUrl: SITE_API_URL, headers: !member.signedIn && token ? { "x-guest-session": token } : undefined }),
    [api, member.signedIn],
  );

  const finish = useCallback(
    (orderNumber: string) => {
      finishing.current = true;
      clearCart();
      router.replace(`/${locale}/store/confirmation/${encodeURIComponent(orderNumber)}?placed=1`);
    },
    [clearCart, router, locale],
  );

  function editOrder() {
    setOrder(null);
    setPi(null);
    setProcessing(false);
  }

  async function review() {
    setTouched(true);
    if (Object.keys(problems).length) {
      showAlert({ text: t("fixFields"), tone: "error" });
      return;
    }
    setBusy(true);
    showAlert(null);
    try {
      let token = guest?.sessionToken ?? null;
      if (!member.signedIn && !token) {
        const g = await startGuestSession({ name: fields.name.trim(), email: fields.email.trim() }).catch(() => null);
        token = g?.sessionToken ?? null;
        if (!token) {
          showAlert({ text: te("NETWORK_ERROR"), tone: "error" });
          return;
        }
      }
      const res = await createShopOrder(
        {
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity, variant: i.variant ?? null })),
          fulfillmentType: fulfillment,
          locationId: shipping ? null : locationId,
          creditsToApply: useCredits && credits ? credits : 0,
          giftCardCode: card?.code ?? null,
          shipping: {
            name: fields.name.trim(),
            email: fields.email.trim(),
            ...(shipping
              ? { address1: fields.address1.trim(), address2: fields.address2.trim() || undefined, city: fields.city.trim(), state: fields.state.trim(), zip: fields.zip.trim(), country: "US" }
              : {}),
          },
        },
        shopCall(token),
      );
      if (!res.ok) {
        const code = storeErrorCode(res.error.code, res.status);
        if (code === "GIFT_CARD_INVALID") {
          setCard(null);
          setCardState("invalid");
        }
        showAlert({ text: te(code), tone: "error" });
        return;
      }
      const created = res.data;
      if (created.paymentStatus === "PAID") {
        finish(created.orderNumber);
        return;
      }
      setOrder(created);
      const intent = await shopPaymentIntent(created.id, shopCall(token));
      if (!intent.ok || !intent.data.clientSecret) {
        const code = storeErrorCode(intent.error.code, intent.status);
        if (code === "ORDER_NOT_PENDING") setOrder(null);
        showAlert({ text: te(code), tone: "error" });
        return;
      }
      setPi({ clientSecret: intent.data.clientSecret, amountCents: intent.data.amountCents });
    } finally {
      setBusy(false);
    }
  }

  /** Stripe succeeded: remember the PaymentIntent (a reload resumes) and finish with it. */
  function paymentSucceeded(paymentIntentId: string) {
    if (!order) return;
    const p: PendingShop = { orderId: order.id, orderNumber: order.orderNumber, paymentIntentId };
    savePending(sessionStorageOrNull(), PENDING_SHOP_KEY, p);
    finishPaid(p);
  }

  /**
   * POST /shop/orders/:id/confirm-payment with the succeeded PaymentIntent,
   * retried with the same id (idempotent on the server). Only a refunded
   * charge or a changed order goes back to review; anything else stays on
   * "Payment received" with Retry and support, never on Pay.
   */
  async function finishPaid(p: PendingShop) {
    if (confirming.current) return;
    confirming.current = true;
    setPaid(p);
    setPaidState("finishing");
    showAlert(null);
    try {
      const res = await finishWithRetry(() => shopConfirmPayment(p.orderId, p.paymentIntentId, shopCall(guest?.sessionToken)));
      const outcome = shopFinishOutcome(res, RECREATE_CODES);
      if (outcome === "done") {
        clearPending(sessionStorageOrNull(), PENDING_SHOP_KEY);
        finish(res.data?.orderNumber || p.orderNumber);
        return;
      }
      if (outcome === "stuck") {
        setPaidState("stuck");
        return;
      }
      if (outcome === "review") {
        // A person is checking this payment: keep the page here (and on reload) so nobody pays twice.
        setPaidState("review");
        return;
      }
      // reprice: the server returned the charge (or the order changed); review again.
      clearPending(sessionStorageOrNull(), PENDING_SHOP_KEY);
      setPaid(null);
      editOrder();
      const code = storeErrorCode(res.error.code, res.status);
      if (res.error.refunded === true) {
        const which: "CREDIT_SHORT" | "GIFT_CARD_CHANGED" | "OUT_OF_STOCK" | "GENERIC" = code === "CREDIT_SHORT" || code === "GIFT_CARD_CHANGED" || code === "OUT_OF_STOCK" ? code : "GENERIC";
        if (code === "CREDIT_SHORT") {
          setCredits(null);
          refreshCredits();
        }
        if (code === "GIFT_CARD_CHANGED" && card) checkCard(card.code);
        showAlert({ text: tn(which), tone: "calm" });
      } else {
        showAlert({ text: te(code), tone: "calm" });
      }
    } finally {
      confirming.current = false;
    }
  }

  // A reload after Stripe succeeded resumes the finish (same PaymentIntent) instead of a new payment.
  useEffect(() => {
    if (!hydrated || !member.ready || guestLoading || resumed.current) return;
    resumed.current = true;
    const p = loadPending(sessionStorageOrNull(), PENDING_SHOP_KEY, isPendingShop);
    if (p) finishPaid(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, member.ready, guestLoading]);

  async function refreshCredits() {
    if (!member.userId) return;
    const profile = await api(`${SITE_API_URL}/users/${encodeURIComponent(member.userId)}/profile?locale=${locale}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const next = typeof profile?.membership?.credits === "number" ? profile.membership.credits : 0;
    setCredits(next);
    if (next <= 0) setUseCredits(false);
  }

  // An emptied bag (another tab) sends the visitor back to the shelf, unless this page just finished.
  useEffect(() => {
    if (hydrated && items.length === 0 && !finishing.current && !paid && !loadPending(sessionStorageOrNull(), PENDING_SHOP_KEY, isPendingShop)) router.replace(`/${locale}/store/cart`);
  }, [hydrated, items.length, router, locale, paid]);

  if (paid) {
    return (
      <PaymentReceived
        state={paidState}
        finishingText={t("received.finishing")}
        stuckText={t("received.stuck")}
        reviewText={te("NEEDS_REVIEW")}
        reference={{ label: t("received.number"), value: paid.orderNumber }}
        onRetry={() => finishPaid(paid)}
      />
    );
  }

  if (!hydrated || items.length === 0) {
    return <div className="mx-auto mt-10 h-64 max-w-5xl animate-pulse rounded-3xl bg-oh-ink px-4 motion-reduce:animate-none" />;
  }

  // ------------------------------------------------------------ render
  const due = pi ? pi.amountCents : order ? order.totalCents : null;
  const err = (k: keyof Fields | "location") => (touched ? problems[k] : undefined);
  const field = (k: keyof Fields, label: string, opts: { type?: string; autoComplete?: string; inputMode?: "email" | "numeric" | "text"; optional?: boolean; hint?: string; maxLength?: number } = {}) => {
    const id = `${ids}-${k}`;
    const e = err(k);
    return (
      <div className="min-w-0">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        <input
          id={id}
          name={k}
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength ?? 120}
          value={fields[k]}
          disabled={locked}
          aria-invalid={e ? true : undefined}
          aria-describedby={[e ? `${id}-err` : "", opts.hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined}
          onChange={(ev) => setFields((f) => ({ ...f, [k]: ev.target.value }))}
          className={FIELD}
          data-field={k}
        />
        {opts.hint ? (
          <p id={`${id}-hint`} className="m-0 mt-1.5 text-sm text-oh-mute">
            {opts.hint}
          </p>
        ) : null}
        {e ? (
          <p id={`${id}-err`} className="m-0 mt-1.5 text-sm text-oh-ember-light">
            {e}
          </p>
        ) : null}
      </div>
    );
  };

  const choice = (value: Fulfillment, title: string, body: string, icon: "store" | "pin") => (
    <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-oh-cream ${fulfillment === value ? "border-oh-ember-light bg-oh-ember-deep/15" : "border-oh-stone"} ${locked ? "cursor-not-allowed opacity-70" : ""}`}>
      <input type="radio" name="fulfillment" value={value} checked={fulfillment === value} disabled={locked} onChange={() => setFulfillment(value)} className="sr-only" data-fulfillment={value} />
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${fulfillment === value ? "bg-oh-ember-deep text-oh-cream" : "bg-oh-stone/60 text-oh-cream/85"}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-semibold text-oh-cream">{title}</span>
        <span className="text-sm text-oh-cream/75">{body}</span>
      </span>
    </label>
  );

  const cta: { label: string; onClick?: () => void; busy: boolean; data: string; type?: "submit"; form?: string } = !pi
    ? { label: busy ? t("reviewing") : t("reviewCta"), onClick: review, busy, data: "data-review" }
    : { label: t("payCta", { amount: money(pi.amountCents) }), type: "submit", form: FORM_ID, busy: processing, data: "data-pay-submit" };

  return (
    <div data-store-checkout className="mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-10">
      <Reveal from="fade">
        <Title locale={locale} as="h1" className="m-0 text-oh-cream">
          {t("title")}
        </Title>
        {!member.signedIn && member.ready ? <p className="m-0 mt-2 text-base text-oh-mute">{t("guestNote")}</p> : null}
      </Reveal>

      <div className="mt-7 grid gap-6 pb-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {locked ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-oh-olive/25 px-4 py-3 text-[15px] text-oh-cream" data-locked>
              <span className="min-w-0 flex-1">{t("locked")}</span>
              <button type="button" onClick={editOrder} disabled={processing} className={TEXT_LINK} data-edit>
                {t("edit")}
              </button>
            </div>
          ) : null}

          <section aria-labelledby={`${ids}-how`} className={PANEL}>
            <h2 id={`${ids}-how`} className={PANEL_TITLE}>
              {t("howTitle")}
            </h2>
            <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
              <legend className="sr-only">{t("howTitle")}</legend>
              {choice("SHIPPING", t("ship"), t("shipBody", { amount: money(FREE_SHIPPING_MIN_CENTS) }), "store")}
              {choice("IN_STORE_PICKUP", t("pickup"), t("pickupBody"), "pin")}
            </fieldset>
            {!shipping ? (
              <div className="mt-4">
                <label htmlFor={`${ids}-loc`} className={LABEL}>
                  {t("pickupWhere")}
                </label>
                <select id={`${ids}-loc`} value={locationId} disabled={locked} onChange={(e) => setLocationId(e.target.value)} aria-invalid={err("location") ? true : undefined} className={`${FIELD} cursor-pointer`} data-field="location">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>

          <section aria-labelledby={`${ids}-contact`} className={PANEL}>
            <h2 id={`${ids}-contact`} className={PANEL_TITLE}>
              {t("contactTitle")}
            </h2>
            <div className="grid gap-4">
              {field("name", t("name"), { autoComplete: "name" })}
              {field("email", t("email"), { type: "email", inputMode: "email", autoComplete: "email", hint: t("emailHint"), maxLength: 254 })}
            </div>
          </section>

          {shipping ? (
            <section aria-labelledby={`${ids}-addr`} className={PANEL}>
              <h2 id={`${ids}-addr`} className={PANEL_TITLE}>
                {t("addressTitle")}
              </h2>
              <div className="grid gap-4">
                {field("address1", t("address1"), { autoComplete: "address-line1" })}
                {field("address2", t("address2"), { autoComplete: "address-line2", optional: true })}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.9fr)]">
                  {field("city", t("city"), { autoComplete: "address-level2" })}
                  {field("state", t("state"), { autoComplete: "address-level1", maxLength: 40 })}
                  {field("zip", t("zip"), { autoComplete: "postal-code", inputMode: "numeric", maxLength: 10 })}
                </div>
              </div>
            </section>
          ) : null}

          <section aria-labelledby={`${ids}-save`} className={PANEL} data-savings-panel>
            <h2 id={`${ids}-save`} className={PANEL_TITLE}>
              {t("savingsTitle")}
            </h2>
            {member.signedIn ? (
              <div className="flex items-center gap-3" data-store-credits>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-oh-cream">{t("credits")}</span>
                  <span className="text-sm text-oh-mute">{credits === null ? t("loading") : credits > 0 ? t("creditsAvailable", { amount: money(credits) }) : t("creditsNone")}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCredits}
                  aria-label={t("credits")}
                  disabled={locked || !credits}
                  onClick={() => setUseCredits((v) => !v)}
                  className={`relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full border-0 p-0 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${useCredits ? "bg-oh-olive" : "bg-oh-stone"}`}
                >
                  <span aria-hidden="true" className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-oh-cream shadow transition-transform duration-200 motion-reduce:transition-none ${useCredits ? "translate-x-6" : ""}`} />
                </button>
              </div>
            ) : member.ready ? (
              <p className="m-0 flex flex-wrap items-center gap-x-2 text-[15px] text-oh-cream/85">
                {t("creditsSignIn")}
                <SignInTrigger returnTo={`/${locale}/store/checkout`}>
                  <button type="button" className={TEXT_LINK} disabled={locked}>
                    {t("signIn")}
                  </button>
                </SignInTrigger>
              </p>
            ) : null}

            <div className="mt-5 border-t border-oh-stone/70 pt-5">
              {card ? (
                <div className="flex flex-wrap items-center justify-between gap-3" data-gift-applied>
                  <span className="flex min-w-0 items-center gap-2 text-[15px] text-oh-cream">
                    <Icon name="gift" size={18} className="shrink-0 text-oh-gold" />
                    {t("giftCardApplied", { amount: money(card.balanceCents) })}
                  </span>
                  <button type="button" disabled={locked} onClick={() => setCard(null)} className={TEXT_LINK}>
                    {t("giftCardRemove")}
                  </button>
                </div>
              ) : (
                <div>
                  <label htmlFor={`${ids}-gc`} className={LABEL}>
                    {t("giftCardLabel")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${ids}-gc`}
                      value={codeInput}
                      disabled={locked}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={cardState === "invalid" ? true : undefined}
                      aria-describedby={`${ids}-gc-hint`}
                      onChange={(e) => {
                        setCodeInput(formatGiftCode(e.target.value));
                        setCardState("idle");
                      }}
                      className={`${FIELD} min-w-0 flex-1 font-mono tracking-[0.08em]`}
                      data-field="giftCard"
                    />
                    <button type="button" disabled={locked || !giftCodeComplete(codeInput) || cardState === "checking"} onClick={() => checkCard(codeInput)} className="min-h-12 shrink-0 cursor-pointer appearance-none rounded-xl border border-oh-cream/35 bg-transparent px-4 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-not-allowed disabled:opacity-50" data-gift-apply>
                      {cardState === "checking" ? t("giftCardChecking") : t("giftCardApply")}
                    </button>
                  </div>
                  <p id={`${ids}-gc-hint`} className={`m-0 mt-1.5 text-sm ${cardState === "invalid" ? "text-oh-ember-light" : "text-oh-mute"}`}>
                    {cardState === "invalid" ? t("giftCardInvalid") : t("giftCardHint")}
                  </p>
                </div>
              )}
            </div>
            <p className="m-0 mt-4 text-sm text-oh-mute">{t("noPromo")}</p>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:sticky md:top-24">
          <section aria-labelledby={`${ids}-sum`} className={PANEL} data-store-summary>
            <h2 id={`${ids}-sum`} className={PANEL_TITLE}>
              {t("summaryTitle")}
            </h2>
            <ul className="m-0 mb-4 flex list-none flex-col gap-3 p-0">
              {items.map((i) => {
                const row = catalog?.get(i.id);
                const name = row ? localizeProduct(row, locale).name : i.name;
                return (
                  <li key={`${i.id}-${i.variant ?? ""}`} className="flex items-center gap-3">
                    <ProductPhoto image={productImage(row ?? { slug: i.slug, imageUrl: null })} alt="" sizes="48px" className="w-12 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1 text-[15px] leading-snug text-oh-cream [overflow-wrap:anywhere]">
                      {name}
                      {i.variant ? <span className="text-oh-mute"> / {i.variant}</span> : null}
                      <span className="text-oh-mute">{` \u00d7${i.quantity}`}</span>
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums text-oh-cream/90">{money(i.priceCents * i.quantity)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="m-0 flex flex-col gap-2 border-t border-oh-stone/70 pt-4">
              {order ? (
                <>
                  <MoneyRow label={t("items")} value={money(order.subtotalCents)} />
                  <MoneyRow label={shipping ? t("shipping") : t("pickupLine")} value={order.shippingCents > 0 ? money(order.shippingCents) : t("shippingFree")} />
                  {order.creditsApplied > 0 ? <MoneyRow label={t("creditLine")} value={`-${money(order.creditsApplied)}`} /> : null}
                  {order.giftCardApplied > 0 ? <MoneyRow label={t("giftCardLine")} value={`-${money(order.giftCardApplied)}`} /> : null}
                  <MoneyRow label={t("tax")} value={money(order.taxCents)} />
                  <MoneyRow label={t("due")} value={<span data-total data-cents={order.totalCents}>{money(order.totalCents)}</span>} strong className="mt-1 border-t border-oh-stone/70 pt-3" />
                </>
              ) : (
                <MoneyRow label={t("items")} value={money(subtotalCents)} />
              )}
            </dl>
            {order ? null : <p className="m-0 mt-2 text-sm text-oh-mute">{t("beforeReview")}</p>}
          </section>

          {order ? (
            <section aria-labelledby={`${ids}-pay`} className={PANEL} data-store-pay>
              <h2 id={`${ids}-pay`} className={PANEL_TITLE}>
                <Icon name="wallet" size={16} />
                {t("payTitle")}
              </h2>
              {pi ? (
                <StripeProvider key={pi.clientSecret} clientSecret={pi.clientSecret} locale={stripeLocale(locale)} appearance={NIGHT_APPEARANCE} fonts={STRIPE_FONTS}>
                  <PaymentForm
                    amountCents={pi.amountCents}
                    formId={FORM_ID}
                    hideSubmit
                    tone="night"
                    showExpressCheckout
                    savedPaymentMethods={order.userId && member.userId === order.userId ? saved : []}
                    returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/store/confirmation/${encodeURIComponent(order.orderNumber)}?shopOrderId=${encodeURIComponent(order.id)}`}
                    onSuccess={(id) => paymentSucceeded(id)}
                    onError={(message) => showAlert({ text: message || te("GENERIC"), tone: "error" })}
                    onProcessingChange={setProcessing}
                    labels={{
                      submit: t("payCta", { amount: money(pi.amountCents) }),
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
              ) : (
                <div role="status" className="flex min-h-32 items-center justify-center gap-3 text-oh-mute">
                  <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
                  {t("loading")}
                </div>
              )}
              <p className="m-0 mt-4 flex items-center gap-2 text-sm text-oh-mute">
                <Icon name="seal" size={16} className="shrink-0" />
                {t("secure")}
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-[var(--dock-h)] z-30 -mx-4 border-t border-oh-stone/70 bg-oh-charcoal/95 backdrop-blur-md md:-mx-8">
        {alert ? (
          <div className="mx-auto w-full max-w-5xl px-4 pt-3 md:px-8">
            <div ref={alertRef} tabIndex={-1} role="alert" data-store-alert={alert.tone} className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug text-oh-cream outline-none ${alert.tone === "calm" ? "bg-oh-olive/30" : "bg-oh-ember-deep/25"}`}>
              <Icon name={alert.tone === "calm" ? "seal" : "alert"} size={18} className={`mt-0.5 shrink-0 ${alert.tone === "calm" ? "text-oh-olive-light" : "text-oh-ember-light"}`} />
              <span className="min-w-0 flex-1">{alert.text}</span>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 md:px-8">
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="text-xs text-oh-mute">{order ? t("due") : t("items")}</span>
            <span className="text-lg font-semibold tabular-nums text-oh-cream" aria-live="polite" data-due data-cents={due ?? undefined}>
              {money(due ?? subtotalCents)}
            </span>
          </div>
          <button
            type={cta.type ?? "button"}
            form={cta.form}
            onClick={cta.onClick}
            disabled={cta.busy}
            aria-busy={cta.busy ? "true" : "false"}
            data-store-cta
            {...{ [cta.data]: "" }}
            className={`${PRIMARY} h-14 min-w-0 flex-1`}
          >
            {cta.busy ? <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : null}
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

