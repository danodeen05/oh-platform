"use client";

/**
 * Task D8: /member/orders. The member's paid orders (GET /users/:id/orders,
 * newest first) as receipts: the date in the locale and America/Denver, a
 * translated status, the kitchen number and pod, the bowls and paid add-ons
 * in the reader's language (the menu item's per-locale name columns), and
 * the total. An order still in the kitchen links to its live status page
 * (or, before it has a QR code, to its confirmation page by id).
 * "Order again" opens the order builder.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { localizedHref } from "@/lib/site/nav";
import { formatDateTime, formatMoney } from "./format";
import { SignedOutPassport } from "./SignedOutPassport";
import { SubpageHeader } from "./SubpageHeader";
import { fetchWithRetry } from "./usePassport";

interface MenuItemRow {
  name: string;
  nameZhTW?: string | null;
  nameZhCN?: string | null;
  nameEs?: string | null;
}

interface OrderItemRow {
  id: string;
  quantity: number;
  priceCents: number;
  menuItem: MenuItemRow | null;
}

interface OrderRow {
  id: string;
  kitchenOrderNumber: string | null;
  orderQrCode: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
  items: OrderItemRow[];
  location: { id: string; name: string; i18n?: Record<string, { name?: string }> | null } | null;
  seat: { label?: string | null } | null;
  childOrders?: Array<{ addOnType?: string; items: OrderItemRow[] }>;
}

const STATUSES = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED", "CANCELLED"] as const;
const LIVE = new Set(["PAID", "QUEUED", "PREPPING", "READY", "SERVING"]);

export function itemName(item: MenuItemRow | null, locale: string): string {
  if (!item) return "";
  const byLocale: Record<string, string | null | undefined> = { "zh-TW": item.nameZhTW, "zh-CN": item.nameZhCN, es: item.nameEs };
  return byLocale[locale] || item.name;
}

/**
 * Where "Track it" goes for a live (unfinished) order, or null once it's
 * done. The status page is keyed by the order's QR code; a live order
 * without one yet is tracked on the confirmation page, which looks the
 * order up by id. A live order never offers "Order again".
 */
export function orderTrackHref(order: Pick<OrderRow, "id" | "status" | "orderQrCode">, locale: string): string | null {
  if (!LIVE.has(order.status)) return null;
  return order.orderQrCode
    ? `${localizedHref(locale, "/order/status")}?orderQrCode=${encodeURIComponent(order.orderQrCode)}`
    : `${localizedHref(locale, "/order/confirmation")}?orderId=${encodeURIComponent(order.id)}`;
}

function locationName(loc: OrderRow["location"], locale: string): string {
  if (!loc) return "";
  return loc.i18n?.[locale]?.name || loc.name;
}

type State = { status: "loading" } | { status: "signedOut" } | { status: "error" } | { status: "ready"; orders: OrderRow[] };

function Receipt({ order, index }: { order: OrderRow; index: number }) {
  const t = useTranslations("passport.orders");
  const locale = useLocale();
  const status = (STATUSES as readonly string[]).includes(order.status) ? order.status : "PAID";
  const lines = [
    ...order.items,
    ...(order.childOrders ?? []).filter((c) => c.addOnType === "PAID_ADDON").flatMap((c) => c.items),
  ].filter((i) => i.priceCents > 0 && i.menuItem);
  const shown = lines.slice(0, 3);
  const trackHref = orderTrackHref(order, locale);
  const live = trackHref !== null;

  return (
    <Reveal as="li" delay={Math.min(index, 4) * 60} data-order-card className="min-w-0 rounded-2xl bg-oh-linen p-5 text-oh-ink">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-base font-semibold">{formatDateTime(order.createdAt, locale)}</p>
          <p className="m-0 mt-0.5 text-sm text-oh-ink/75">
            <span data-order-location>{locationName(order.location, locale)}</span>
            {order.seat?.label ? <span>{` · ${order.seat.label}`}</span> : null}
          </p>
        </div>
        <span
          data-order-status={status}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
            status === "CANCELLED" ? "bg-oh-ink/10 text-oh-ink/70" : LIVE.has(status) ? "bg-oh-ember-deep text-oh-cream" : "bg-oh-olive/20 text-oh-ink"
          }`}
        >
          {t(`status.${status}`)}
        </span>
      </div>
      <ul className="m-0 mt-4 list-none space-y-1.5 border-0 border-t border-dashed border-oh-ink/25 p-0 pt-4">
        {shown.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-base">
            <span className="min-w-0">
              {item.quantity > 1 ? <span className="tabular-nums text-oh-ink/70">{`${item.quantity} × `}</span> : null}
              {itemName(item.menuItem, locale)}
            </span>
            <span className="shrink-0 tabular-nums text-oh-ink/80">{formatMoney(item.priceCents * item.quantity, locale)}</span>
          </li>
        ))}
        {lines.length > shown.length ? <li className="text-sm text-oh-ink/70">{t("more", { count: lines.length - shown.length })}</li> : null}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-oh-ink/15 pt-4">
        <p className="m-0 text-base">
          <span className="text-oh-ink/75">{t("total")}</span>{" "}
          <span className="font-semibold tabular-nums">{formatMoney(order.totalCents, locale)}</span>
          {order.kitchenOrderNumber ? <span className="ml-3 text-sm text-oh-ink/70">{t("number", { number: order.kitchenOrderNumber })}</span> : null}
        </p>
        {live ? (
          <Link
            href={trackHref!}
            data-order-track
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oh-ink px-4 text-sm font-semibold text-oh-cream no-underline hover:bg-oh-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ink"
          >
            {t("track")}
            <Icon name="arrow" size={16} />
          </Link>
        ) : (
          <Link
            href={localizedHref(locale, "/order")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oh-ink/35 px-4 text-sm font-semibold text-oh-ink no-underline hover:border-oh-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ink"
          >
            {t("again")}
          </Link>
        )}
      </div>
    </Reveal>
  );
}

export function OrdersHistory() {
  const t = useTranslations("passport.orders");
  const tp = useTranslations("passport");
  const locale = useLocale();
  const api = useSiteApi();
  const { userId, ready, signedIn } = useMemberId();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) return setState({ status: "signedOut" });
    if (!userId) return setState({ status: "error" });
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetchWithRetry(api, `${SITE_API_URL}/users/${encodeURIComponent(userId)}/orders`);
        if (!res.ok) throw new Error(String(res.status));
        const orders = (await res.json()) as OrderRow[];
        if (!cancelled) setState({ status: "ready", orders: Array.isArray(orders) ? orders : [] });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, userId, attempt]);

  if (state.status === "signedOut") return <SignedOutPassport program={null} />;

  return (
    <div data-orders-page={state.status} className="px-4 pb-16 pt-4 md:px-8 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <SubpageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          lede={state.status === "ready" ? t("count", { count: state.orders.length }) : undefined}
        />
        {state.status === "loading" ? (
          <p role="status" className="m-0 mt-8 text-base text-oh-cream/70">
            {tp("loading")}
          </p>
        ) : null}
        {state.status === "error" ? (
          <div role="alert" className="mt-8">
            <p className="m-0 text-base text-oh-cream/80">{tp("error.body")}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-4 inline-flex min-h-12 cursor-pointer appearance-none items-center rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {tp("error.retry")}
            </button>
          </div>
        ) : null}
        {state.status === "ready" && state.orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-oh-stone p-6">
            <p className="m-0 text-base text-oh-cream/80">{t("empty")}</p>
            <Link
              href={localizedHref(locale, "/order")}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("emptyCta")}
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        ) : null}
        {state.status === "ready" && state.orders.length > 0 ? (
          <ul className="m-0 mt-8 grid list-none gap-4 p-0">
            {state.orders.map((o, i) => (
              <Receipt key={o.id} order={o} index={i} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
