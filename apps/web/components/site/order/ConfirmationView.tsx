"use client";

/**
 * Order confirmation (Task D6). Reached after the group payment, a group
 * lobby's link, and the pay step when an order has no QR code yet.
 *
 * Payment: with Stripe's return params (`payment_intent_client_secret` and
 * `redirect_status=succeeded`) the page asks the server to verify the
 * PaymentIntent with `confirmPayment` (A7). That call is idempotent (the
 * webhook uses it too), so a refresh just reads the paid order again.
 * D12: when the pod moved at payment, the confirm response's `podChange`
 * (or the pay step's `?podFrom=`) puts "Your pod is now B-07" up top.
 *
 * Owner view: the order is read with the Clerk token or the guest session
 * (A8b), so the owner sees the QR code and the SMS-consent sheet can check
 * their phone and consent (PhoneCollectionModal, unchanged).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useSiteAuth } from "@/lib/site/auth";
import { Display, Eyebrow } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { PhoneCollectionModal } from "@/components/PhoneCollectionModal";
import { trackPurchase, event } from "@/lib/analytics";
import { useSiteApi, SITE_API_URL } from "@/lib/site/api";
import { confirmPayment, groupIdentityHeaders, paymentIntentIdFromClientSecret } from "@/lib/site/orders";
import { formatCents } from "@/lib/site/order-flow";
import { formatClock, podMoved } from "@/lib/site/order-status";
import { useGuest } from "@/contexts/guest-context";
import { PodCard, PRIMARY, SECONDARY } from "./PodCard";
import { Spinner } from "./StepSheet";
import { TENANT } from "./useOrderStatus";
import "./after-order.css";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyOrder = any;

export interface ConfirmationViewProps {
  orderId: string | null;
  orderNumber: string | null;
  totalParam: string | null;
  paid: boolean;
  groupCode: string | null;
  clientSecret: string | null;
  redirectStatus: string | null;
  podFrom: string | null;
}

export function ConfirmationView({ orderId, orderNumber, totalParam, paid, groupCode, clientSecret, redirectStatus, podFrom }: ConfirmationViewProps) {
  const t = useTranslations("afterOrder");
  const locale = useLocale();
  const api = useSiteApi();
  const { guest } = useGuest();
  const { isLoaded, isSignedIn, email: authEmail, name: authName } = useSiteAuth();
  const [order, setOrder] = useState<AnyOrder | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "missing">(orderId || groupCode ? "loading" : "missing");
  const [groupOrders, setGroupOrders] = useState<AnyOrder[]>([]);
  const [podChange, setPodChange] = useState<{ changed?: boolean; from?: string | null; to?: string | null; noPod?: boolean } | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneDone, setPhoneDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const tracked = useRef(false);
  const handled = useRef(false);
  const stripeReturn = Boolean(clientSecret) && redirectStatus === "succeeded";
  const identity = groupIdentityHeaders(guest);

  // Read (and, back from Stripe, verify) the order once Clerk knows who this is.
  useEffect(() => {
    if ((!orderId && !groupCode) || !isLoaded || handled.current) return;
    handled.current = true;
    (async () => {
      const loadGroup = async (code: string) => {
        const g = await fetch(`${SITE_API_URL}/group-orders/${encodeURIComponent(code)}`, { headers: TENANT }).catch(() => null);
        const gd = g && g.ok ? await g.json().catch(() => null) : null;
        const list: AnyOrder[] = Array.isArray(gd?.orders) ? gd.orders : [];
        setGroupOrders(list);
        return list;
      };
      // The group lobby links here with only its code: the host's order is the one to show.
      let id = orderId;
      let groupLoaded = false;
      if (!id && groupCode) {
        const list = await loadGroup(groupCode);
        groupLoaded = true;
        id = (list.find((o) => o.isGroupHost) || list[0])?.id || null;
      }
      if (!id) {
        setLoad("missing");
        return;
      }
      const orderKey = id;
      const read = async () => {
        const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderKey)}?locale=${encodeURIComponent(locale)}`, { headers: { ...TENANT, ...identity } }).catch(() => null);
        return res && res.ok ? await res.json().catch(() => null) : null;
      };
      let current = await read();
      // Always verified on a Stripe return: idempotent for the same PaymentIntent, and a second charge
      // (two tabs, a retry) is refunded by the server rather than kept.
      if (stripeReturn) {
        // Make sure the member row exists before the order is finalized for them (legacy behavior).
        const email = authEmail;
        if (isSignedIn && email && current?.paymentStatus !== "PAID") {
          await api(`${SITE_API_URL}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name: authName || undefined }) }).catch(() => null);
        }
        const confirmed = await confirmPayment(orderKey, paymentIntentIdFromClientSecret(clientSecret), { fetcher: api, baseUrl: SITE_API_URL, headers: identity });
        if (confirmed.ok) {
          const data = confirmed.data as AnyOrder;
          if (data?.podChange?.changed) setPodChange(data.podChange);
          // The confirm response is the localized-less order; read the page's language version when we can.
          current = (await read()) || data;
        }
      }
      if (!current) {
        setLoad("missing");
        return;
      }
      setOrder(current);
      setLoad("ready");
      const code = groupCode || current.groupOrderId;
      if (code && !groupLoaded) await loadGroup(code);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, isLoaded]);

  // The shell's active-order pill follows this order.
  useEffect(() => {
    if (!order?.orderQrCode) return;
    try {
      localStorage.setItem("activeOrderQrCode", order.orderQrCode);
    } catch {
      /* storage blocked */
    }
  }, [order?.orderQrCode]);

  // Analytics: one purchase event per order.
  useEffect(() => {
    if (!order || !paid || tracked.current) return;
    tracked.current = true;
    trackPurchase({
      orderId: order.id || orderId || "",
      total: (order.totalCents ?? Number(totalParam || 0)) / 100,
      items: (order.items || []).map((i: AnyOrder) => ({ id: i.menuItem?.id || i.id, name: i.menuItem?.name || "", price: (i.priceCents || 0) / 100, quantity: i.quantity || 1 })),
    });
    event({ action: "order_confirmed", category: "conversion", label: order.orderNumber || orderNumber || "", value: order.totalCents ?? Number(totalParam || 0) });
  }, [order, paid, orderId, orderNumber, totalParam]);

  // SMS consent: a paid order whose member has no phone or hasn't opted in (unchanged rule, A8b identity).
  useEffect(() => {
    const u = order?.user;
    const hasPhone = typeof u?.phone === "string" && u.phone.trim() !== "";
    if (!u || !paid || phoneDone || phoneOpen || (hasPhone && u.smsOptIn)) return;
    const timer = setTimeout(() => setPhoneOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [order, paid, phoneDone, phoneOpen]);

  async function share() {
    let referral: string | null = null;
    try {
      referral = localStorage.getItem("referralCode");
    } catch {
      referral = null;
    }
    const url = referral ? `${window.location.origin}/${locale}/order?ref=${encodeURIComponent(referral)}` : `${window.location.origin}/${locale}`;
    const text = t("confirmation.share.text", { url });
    if (navigator.share) {
      await navigator.share({ text, url }).catch(() => undefined);
      event({ action: "share", category: "engagement", label: "native", content_type: "order", item_id: orderNumber || "" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function checkInAll() {
    setCheckingAll(true);
    for (const o of groupOrders) {
      if (!o.arrivedAt && o.orderQrCode) {
        await fetch(`${SITE_API_URL}/orders/check-in`, { method: "POST", headers: { "Content-Type": "application/json", ...TENANT }, body: JSON.stringify({ orderQrCode: o.orderQrCode }) }).catch(() => null);
      }
    }
    window.location.reload();
  }

  if (load !== "ready" || !order) {
    return (
      <div data-confirmation-page data-state={load} className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col justify-center gap-4 px-4 py-10">
        {load === "loading" ? (
          <p role="status" className="m-0 flex items-center gap-2.5 text-[15px] text-oh-mute">
            <Spinner />
            {t("common.loading")}
          </p>
        ) : (
          <>
            <Display locale={locale} className="m-0 !text-[2.25rem] text-oh-cream">
              {t("common.notFound")}
            </Display>
            <p className="m-0 text-base text-oh-mute">{t("common.notFoundLede")}</p>
            <Link href={`/${locale}/order`} className={PRIMARY}>
              {t("common.newOrder")}
            </Link>
          </>
        )}
      </div>
    );
  }

  // The server's payment state wins once the order is loaded; ?paid=true only covers an order it can't show.
  const isPaid = order.paymentStatus ? order.paymentStatus === "PAID" : paid;
  const number = order.kitchenOrderNumber || order.orderNumber || orderNumber || "";
  const pod: string | null = order.seat?.label || order.seat?.number || null;
  const moved = podChange?.changed && podChange.to ? { from: podChange.from || "", to: podChange.to } : podMoved(podFrom, pod);
  const noPod = Boolean(podChange?.noPod);
  const tz = order.location?.timezone || "America/Denver";
  const items: AnyOrder[] = order.items || [];
  const isBowl = (i: AnyOrder) => /^(main|slider)/i.test(i.menuItem?.category || "") || ["MAIN", "SLIDER"].includes(i.menuItem?.categoryType);
  const bowl = items.filter((i) => isBowl(i) && (i.priceCents > 0 || i.menuItem?.categoryType !== "SLIDER"));
  const choices = items.filter((i) => i.menuItem?.categoryType === "SLIDER" && i.selectedValue);
  const extras = items.filter((i) => !isBowl(i));
  const money = (c: number) => formatCents(c, locale);
  const subtotal = order.subtotalCents ?? items.reduce((s: number, i: AnyOrder) => s + (i.priceCents || 0), 0);
  const saved = (order.promoDiscountCents || 0) + (order.rewardDiscountCents || 0) + (order.creditsAppliedCents || 0) + (order.giftCardAppliedCents || 0) + (order.mealGiftAppliedCents || 0);
  const total = order.totalCents ?? subtotal;
  const statusHref = order.orderQrCode ? `/${locale}/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode)}` : null;
  const checkInHref = order.orderQrCode ? `/${locale}/order/check-in?orderQrCode=${encodeURIComponent(order.orderQrCode)}` : null;

  return (
    <div data-confirmation-page data-state="ready" className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--dock-h,0px)+2.5rem)] pt-4 md:max-w-6xl md:px-8 md:pt-10">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-10">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="confirm-title">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="oh-mark-in flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream shadow-[0_18px_40px_-18px] shadow-oh-ember-deep">
                <Icon name={isPaid ? "check" : "clock"} size={32} />
              </span>
              <div className="oh-stage-in min-w-0 flex-1">
                <Eyebrow locale={locale} as="p" className="m-0 text-oh-mute">
                  {t("common.orderNumber", { number })}
                </Eyebrow>
                <Display id="confirm-title" locale={locale} className="m-0 mt-1.5 !text-[clamp(2.1rem,8vw,3.25rem)] text-oh-cream">
                  {t("confirmation.title")}
                </Display>
              </div>
            </div>
            <p data-payment-state={isPaid ? "paid" : "pending"} className="m-0 mt-3 flex items-start gap-2 text-base leading-relaxed text-oh-mute">
              {isPaid ? <Icon name="check" size={20} className="mt-0.5 shrink-0 text-oh-olive-light" /> : <Spinner className="mt-1.5" />}
              <span>{isPaid ? t("confirmation.paid", { amount: money(total) }) : t("confirmation.pending")}</span>
            </p>
          </section>

          {moved || noPod ? (
            <div data-pod-moved role="status" className="flex items-start gap-3 rounded-2xl bg-oh-gold/15 px-4 py-3 text-[15px] leading-relaxed text-oh-cream ring-1 ring-inset ring-oh-gold/40">
              <Icon name="pod" size={20} className="mt-0.5 shrink-0 text-oh-gold" />
              <span className="min-w-0">
                {moved ? (
                  <>
                    <strong className="font-semibold">{t("common.podMoved", { to: moved.to })}</strong> {moved.from ? t("common.podMovedLede", { from: moved.from }) : null}
                  </>
                ) : (
                  t("common.podNone")
                )}
              </span>
            </div>
          ) : null}

          {order.orderQrCode && !order.arrivedAt ? (
            <Reveal from="scale">
              <section data-order-qr aria-labelledby="qr-title" className="rounded-[1.75rem] bg-oh-linen px-5 py-6 text-center text-oh-charcoal">
                <h2 id="qr-title" className={`m-0 text-lg font-semibold ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>
                  {t("confirmation.qrTitle")}
                </h2>
                <p className="m-0 mt-1 text-[15px] text-oh-charcoal/75">{t("confirmation.qrLede")}</p>
                <div className="mx-auto mt-4 inline-flex rounded-3xl bg-white p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
                  <QRCodeSVG value={order.orderQrCode} size={196} level="H" title={t("confirmation.qrAlt", { number })} />
                </div>
                <p className="m-0 mt-3 break-all font-mono text-xs text-oh-charcoal/70">{order.orderQrCode}</p>
                {order.estimatedArrival ? <p className="m-0 mt-2 text-[15px]">{t("confirmation.arrival", { time: formatClock(order.estimatedArrival, locale, tz) || "" })}</p> : null}
              </section>
            </Reveal>
          ) : !order.orderQrCode ? (
            <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-mute ring-1 ring-oh-stone">{t("confirmation.signInForCode")}</p>
          ) : null}

          {pod ? <PodCard label={pod} note={order.arrivedAt ? t("status.pod.goTo") : t("confirmation.podNote")} /> : null}

          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            {checkInHref && !order.arrivedAt ? (
              <Link href={checkInHref} data-cta="check-in" className={PRIMARY}>
                <Icon name="qr" size={20} />
                {t("confirmation.checkIn")}
              </Link>
            ) : null}
            {statusHref ? (
              <Link href={statusHref} data-cta="status" className={checkInHref && !order.arrivedAt ? SECONDARY : PRIMARY}>
                <Icon name="clock" size={20} />
                {t("confirmation.track")}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 md:mt-0">
          {groupOrders.length > 1 ? (
            <section aria-labelledby="group-title" className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
              <h2 id="group-title" className="m-0 text-lg font-semibold text-oh-cream">
                {t("confirmation.group.title", { count: groupOrders.length })}
              </h2>
              <ul className="m-0 mt-3 list-none space-y-2 p-0">
                {groupOrders.map((g: AnyOrder, i: number) => (
                  <li key={g.id} className="rounded-2xl bg-oh-charcoal px-4 py-3 ring-1 ring-inset ring-oh-stone">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold text-oh-cream">{g.isGroupHost ? t("confirmation.group.host") : t("confirmation.group.guest", { number: i })}</span>
                      <span className="text-sm text-oh-mute">{g.seat ? t("common.podNumber", { label: g.seat.label || g.seat.number }) : t("confirmation.group.noPod")}</span>
                    </div>
                    <p className="m-0 mt-1 text-sm text-oh-mute">
                      {g.podConfirmedAt ? t("confirmation.group.checkedIn") : g.arrivedAt ? t("confirmation.group.arrived") : t("confirmation.group.waiting")}
                    </p>
                    {!g.arrivedAt && g.orderQrCode ? (
                      <Link href={`/${locale}/order/check-in?orderQrCode=${encodeURIComponent(g.orderQrCode)}`} className={`${SECONDARY} mt-2`}>
                        {t("confirmation.group.checkIn")}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              {groupOrders.some((g: AnyOrder) => !g.arrivedAt && g.orderQrCode) ? (
                <button type="button" onClick={checkInAll} disabled={checkingAll} className={`${PRIMARY} mt-3`}>
                  {checkingAll ? <Spinner /> : null}
                  {t("confirmation.group.checkInAll")}
                </button>
              ) : null}
            </section>
          ) : null}

          <section data-receipt aria-labelledby="receipt-title" className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
            <h2 id="receipt-title" className="m-0 text-lg font-semibold text-oh-cream">
              {t("confirmation.receipt.title")}
            </h2>
            {bowl.length ? <ReceiptGroup title={t("confirmation.receipt.bowl")} items={bowl} money={money} qty={(n) => t("common.qty", { count: n })} /> : null}
            {choices.length ? (
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                {choices.map((i: AnyOrder) => (
                  <li key={i.id} className="rounded-full bg-oh-charcoal px-3 py-1 text-sm text-oh-mute ring-1 ring-inset ring-oh-stone">
                    {i.menuItem?.name} {i.selectedValue}
                  </li>
                ))}
              </ul>
            ) : null}
            {extras.length ? <ReceiptGroup title={t("confirmation.receipt.extras")} items={extras} money={money} qty={(n) => t("common.qty", { count: n })} /> : null}
            <dl className="m-0 mt-4 space-y-1.5 border-t border-oh-stone pt-3 text-[15px]">
              <Row label={t("confirmation.receipt.subtotal")} value={money(subtotal)} />
              {saved > 0 ? <Row label={t("confirmation.receipt.savings")} value={`-${money(saved)}`} /> : null}
              {typeof order.taxCents === "number" ? <Row label={t("confirmation.receipt.tax")} value={money(order.taxCents)} /> : null}
              <Row label={t("confirmation.receipt.total")} value={money(total)} strong />
            </dl>
          </section>

          <section aria-labelledby="share-title" className="rounded-[1.75rem] bg-oh-linen px-5 py-5 text-oh-charcoal">
            <h2 id="share-title" className="m-0 text-lg font-semibold">
              {t("confirmation.share.title")}
            </h2>
            <p className="m-0 mt-1 text-[15px] leading-relaxed text-oh-charcoal/80">{t("confirmation.share.lede")}</p>
            <button type="button" onClick={share} className={`${PRIMARY} mt-4`}>
              <Icon name={copied ? "check" : "share"} size={20} />
              {copied ? t("confirmation.share.copied") : t("confirmation.share.button")}
            </button>
          </section>

          <Link href={`/${locale}`} className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] text-oh-mute underline decoration-oh-stone underline-offset-4 hover:text-oh-cream">
            {t("confirmation.home")}
          </Link>
        </div>
      </div>

      {phoneOpen && order?.user ? (
        <div className="legacy-ui">
          <PhoneCollectionModal
            userId={order.user.id}
            userName={order.user.name?.split(" ")[0]}
            onSubmit={() => {
              setPhoneOpen(false);
              setPhoneDone(true);
            }}
            onSkip={() => {
              setPhoneOpen(false);
              setPhoneDone(true);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReceiptGroup({ title, items, money, qty }: { title: string; items: AnyOrder[]; money: (c: number) => string; qty: (n: number) => string }) {
  return (
    <div className="mt-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-mute">{title}</p>
      <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
        {items.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between gap-3 text-[15px] text-oh-cream">
            <span className="min-w-0">
              {i.menuItem?.name}
              {i.quantity > 1 ? <span className="ml-1.5 text-oh-mute">{qty(i.quantity)}</span> : null}
            </span>
            {i.priceCents > 0 ? <span className="shrink-0 tabular-nums text-oh-mute">{money(i.priceCents)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "pt-1 text-base font-semibold text-oh-cream" : "text-oh-mute"}`}>
      <dt>{label}</dt>
      <dd className="m-0 tabular-nums">{value}</dd>
    </div>
  );
}
