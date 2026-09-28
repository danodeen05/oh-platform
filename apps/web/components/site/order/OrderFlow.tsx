"use client";

/**
 * The order flow after the location (Task D5): bowl, arrival, pod and
 * savings on /{locale}/order/location/[id]?step=..., then the pay step on
 * /{locale}/order/payment. Each step is its own history entry, so the
 * browser's Back, the top bar's Back chevron and a locale switch all land
 * on a real step; the cart itself lives in sessionStorage (`oh-order-draft`).
 *
 * Money: every total is POST /orders/quote; the order is created with
 * POST /orders (server-priced, pod claimed there) when the guest continues
 * from savings. An unpaid order made from the same draft is reused; a
 * changed draft cancels it (giving its pod back) and creates a new one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemberId, useSiteApi, SITE_API_URL } from "@/lib/site/api";
import { create as createOrder, groupIdentityHeaders, type OrderApiError } from "@/lib/site/orders";
import {
  SIGNED_IN_STEPS,
  arrivalIso,
  bowlComplete,
  canReuseOrder,
  clearDraft,
  buildLines,
  draftFromOrderItems,
  draftSignature,
  quoteLines,
  savingsBody,
  seatRequest,
  withMenuDefaults,
  type MenuStep,
  type OrderStepKey,
} from "@/lib/site/order-draft";
import { formatCents, orderErrorCode } from "@/lib/site/order-flow";
import { useGuest } from "@/contexts/guest-context";
import type { CombLayoutKey } from "@/components/site/floor-plan/useSeats";
import { StepSheet, TotalSummary, Spinner } from "./StepSheet";
import { BowlBuilder } from "./BowlBuilder";
import { ArrivalPicker } from "./ArrivalPicker";
import { PodStep } from "./PodStep";
import { SavingsStep } from "./SavingsStep";
import { SignInGate } from "./SignInGate";
import { ClosedPanel } from "./ClosedPanel";
import { useOrderDraft } from "./useOrderDraft";
import { useQuote } from "./useQuote";
import type { ReceiptLine } from "./Receipt";
import "./order.css";

export interface FlowLocation {
  id: string;
  tenantId: string;
  name: string;
  layoutKey: CombLayoutKey | null;
  timezone: string;
}

type Availability = { canOrder: boolean; isOpen: boolean; validArrivalTimes: string[]; preOrder: boolean };

const TENANT = { "x-tenant-slug": "oh" };
const FLOW_STEPS: OrderStepKey[] = ["bowl", "arrival", "pod", "savings"];

export function OrderFlow({ location, dineInEnabled, groupCode = null, reorderId = null }: { location: FlowLocation; dineInEnabled: boolean; groupCode?: string | null; reorderId?: string | null }) {
  const t = useTranslations("orderFlow");
  const te = useTranslations("orderFlow.errors");
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const api = useSiteApi();
  const member = useMemberId();
  const { guest } = useGuest();
  const { draft, ready, update } = useOrderDraft();

  const requested = search.get("step") as OrderStepKey | null;
  const step: OrderStepKey = requested && FLOW_STEPS.includes(requested) ? requested : "bowl";
  const base = `/${locale}/order/location/${encodeURIComponent(location.id)}`;
  const hrefFor = useCallback(
    (s: OrderStepKey) => {
      const q = new URLSearchParams();
      if (s !== "bowl") q.set("step", s);
      if (groupCode) q.set("groupCode", groupCode);
      const qs = q.toString();
      return `${base}${qs ? `?${qs}` : ""}`;
    },
    [base, groupCode],
  );
  const go = useCallback((s: OrderStepKey) => router.push(hrefFor(s)), [router, hrefFor]);

  // ------------------------------------------------------------ data
  const [menu, setMenu] = useState<MenuStep[] | null>(null);
  const [menuError, setMenuError] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [flowError, setFlowError] = useState<{ code: string; refunded?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(!dineInEnabled);
  const [notice, setNotice] = useState<string | null>(null);
  // In-flight guard: a second tap while an order is being made does nothing (state updates are too slow for that).
  const placing = useRef(false);

  const loadMenu = useCallback(async () => {
    setMenuError(false);
    try {
      const res = await fetch(`${SITE_API_URL}/menu/steps?locale=${encodeURIComponent(locale)}`, { headers: TENANT, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMenu(Array.isArray(data?.steps) ? data.steps : []);
    } catch {
      setMenuError(true);
    }
  }, [locale]);
  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${SITE_API_URL}/locations/${encodeURIComponent(location.id)}/availability`, { headers: TENANT, cache: "no-store" });
        if (!res.ok) return;
        const a = await res.json();
        if (!cancelled) {
          setAvailability({
            canOrder: Boolean(a.canOrder),
            isOpen: Boolean(a.isOpen),
            validArrivalTimes: Array.isArray(a.validArrivalTimes) ? a.validArrivalTimes.map(String) : [],
            preOrder: Boolean(a.preOrderMessage),
          });
        }
      } catch {
        /* keep the last answer */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location.id]);

  // The draft follows this location (a different location's pod pick and order don't carry over).
  useEffect(() => {
    if (!ready || !menu) return;
    update((d) => {
      const moved = d.locationId !== location.id;
      return withMenuDefaults({ ...d, locationId: location.id, ...(moved ? { pod: { mode: "best" as const }, order: null } : {}) }, menu);
    });
  }, [ready, menu, location.id, update]);

  // Reorder (member orders page): put a past order's items back in the builder, then ask for arrival.
  const reordered = useRef(false);
  useEffect(() => {
    if (!reorderId || reordered.current || !ready || !menu || !member.ready || !member.signedIn) return;
    reordered.current = true;
    (async () => {
      const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(reorderId)}?locale=${locale}`).catch(() => null);
      const old = res && res.ok ? await res.json().catch(() => null) : null;
      if (!old?.items) return;
      update((d) => draftFromOrderItems({ ...d, locationId: location.id }, menu, old.items));
      // The member orders page creates an unpaid copy first; this flow makes its own, so give that one back.
      if (old.paymentStatus !== "PAID" && old.status === "PENDING_PAYMENT") cancelUnpaid(reorderId);
      router.replace(hrefFor("arrival"));
    })();
  }, [reorderId, ready, menu, member.ready, member.signedIn, api, locale, update, location.id, router, hrefFor]);

  // ------------------------------------------------------------ quote
  const lines = useMemo(() => (menu && ready ? buildLines(draft, menu) : []), [draft, menu, ready]);
  const withSavings = step === "savings";
  const quoteRequest = useMemo(
    () =>
      lines.length && menu && draft.locationId === location.id
        ? { locationId: location.id, items: quoteLines(lines, menu), ...(withSavings ? savingsBody(draft.savings) : {}) }
        : null,
    [lines, menu, draft.locationId, draft.savings, location.id, withSavings],
  );
  const q = useQuote(quoteRequest, api, member.userId);

  // Arrival: the first offered time is the default (one tap fewer); a stale choice is dropped.
  useEffect(() => {
    if (!ready || !availability) return;
    const opts = availability.validArrivalTimes;
    if (opts.length === 0) return;
    if (!draft.arrival || !opts.includes(draft.arrival)) update((d) => ({ ...d, arrival: opts[0] }));
  }, [ready, availability, draft.arrival, update]);

  useEffect(() => setFlowError(null), [step]);

  // ------------------------------------------------------------ actions
  const money = (c: number) => formatCents(c, locale);

  async function addToGroup() {
    if (!groupCode) return;
    setBusy(true);
    setFlowError(null);
    const res = await api(`${SITE_API_URL}/group-orders/${encodeURIComponent(groupCode)}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...TENANT, ...groupIdentityHeaders(member.signedIn ? null : guest) },
      body: JSON.stringify({ items: lines }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => null) : null;
      setFlowError({ code: orderErrorCode(body?.code || body?.error, res?.status) });
      setBusy(false);
      return;
    }
    router.push(`/${locale}/group/${encodeURIComponent(groupCode)}`);
  }

  /** The order as the API has it now (owner view), or null when it can't be read. */
  async function readOrder(id: string): Promise<{ paymentStatus?: string; status?: string; amountDueCents?: number | null; orderQrCode?: string | null } | null> {
    const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(id)}`).catch(() => null);
    return res && res.ok ? await res.json().catch(() => null) : null;
  }

  /** Gives an unpaid order's pod back. Never sent for a paid order (the API refuses that too: 409 ORDER_PAID). */
  async function cancelUnpaid(id: string) {
    await api(`${SITE_API_URL}/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    }).catch(() => undefined);
  }

  /** The draft's order was paid after all (a webhook finished it): stop, say so, and go to it. */
  function toPaidOrder(qr: string | null | undefined) {
    try {
      if (qr) localStorage.setItem("activeOrderQrCode", qr);
      clearDraft(window.sessionStorage);
    } catch {
      /* storage blocked */
    }
    update((d) => ({ ...d, order: null }));
    setNotice(t("alreadyPaidNotice"));
    setTimeout(() => router.push(qr ? `/${locale}/order/status?orderQrCode=${encodeURIComponent(qr)}` : `/${locale}/member`), 2200);
  }

  async function placeOrder() {
    if (!menu || placing.current) return;
    placing.current = true;
    setBusy(true);
    setFlowError(null);
    try {
      const sig = draftSignature(draft, lines);
      const prev = draft.order;
      if (prev) {
        const old = await readOrder(prev.id);
        if (old?.paymentStatus === "PAID") {
          toPaidOrder(old.orderQrCode);
          return;
        }
        const reusable =
          old?.status === "PENDING_PAYMENT" &&
          canReuseOrder(prev, sig, {
            now: Date.now(),
            arrival: draft.arrival,
            offered: availability?.validArrivalTimes || [],
            canOrder: Boolean(availability?.canOrder),
          }) &&
          // Re-quoted: the server still prices this cart and these savings the same.
          q.quote !== null &&
          old.amountDueCents === q.quote.amountDueCents;
        if (reusable) {
          router.push(payHref(prev.id, prev.orderNumber));
          return;
        }
        // Changed, stale, or no longer payable: give its pod back (only while unpaid) and start fresh.
        if (old && old.status !== "CANCELLED") await cancelUnpaid(prev.id);
        update((d) => ({ ...d, order: null }));
      }
      const estimatedArrival = arrivalIso(draft.arrival);
      const res = await createOrder(
        {
          locationId: location.id,
          tenantId: location.tenantId,
          items: lines,
          estimatedArrival,
          seat: seatRequest(draft.pod),
          partySize: draft.partySize,
          ...savingsBody(draft.savings),
        },
        { fetcher: api, baseUrl: SITE_API_URL },
      );
      if (!res.ok) {
        handleError(res.error, res.status);
        setBusy(false);
        return;
      }
      update((d) => ({ ...d, order: { id: res.data.id, orderNumber: res.data.orderNumber, signature: sig, createdAt: Date.now(), arrivalIso: estimatedArrival } }));
      router.push(payHref(res.data.id, res.data.orderNumber));
    } finally {
      placing.current = false;
    }
  }

  function payHref(id: string, orderNumber: string) {
    return `/${locale}/order/payment?orderId=${encodeURIComponent(id)}&orderNumber=${encodeURIComponent(orderNumber)}`;
  }

  function handleError(error: OrderApiError, status: number) {
    const code = orderErrorCode(error.code, status);
    if (code === "DINE_IN_DISABLED") {
      setClosed(true);
      return;
    }
    if (code === "POD_UNAVAILABLE") update((d) => ({ ...d, pod: { mode: "best" } }));
    setFlowError({ code, refunded: error.refunded });
  }

  // ------------------------------------------------------------ render
  const backHref = step === "bowl" ? `/${locale}/order` : hrefFor(FLOW_STEPS[FLOW_STEPS.indexOf(step) - 1]);

  if (closed) {
    return (
      <StepSheet step={step} title={t("closed.title")} backHref={`/${locale}/order`}>
        <ClosedPanel />
      </StepSheet>
    );
  }

  const needsSignIn = SIGNED_IN_STEPS.includes(step) && !groupCode;
  if (needsSignIn && member.ready && !member.signedIn) {
    return (
      <StepSheet step={step} title={t(`${step}.title`)} backHref={backHref}>
        <SignInGate returnTo={hrefFor(step)} />
      </StepSheet>
    );
  }

  const loading = !ready || !menu || (needsSignIn && !member.ready);
  if (menuError && !menu) {
    return (
      <StepSheet step={step} title={t(`${step}.title`)} backHref={backHref}>
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-oh-ink p-5">
          <p className="m-0 text-[15px] text-oh-cream">{t("bowl.loadError")}</p>
          <button type="button" onClick={loadMenu} className="min-h-11 cursor-pointer appearance-none rounded-full border border-oh-stone bg-oh-stone px-5 font-[inherit] text-[15px] font-semibold text-oh-cream">
            {t("retry")}
          </button>
        </div>
      </StepSheet>
    );
  }
  if (loading) {
    return (
      <StepSheet step={step} title={t(`${step}.title`)} backHref={backHref}>
        <div role="status" className="flex min-h-[40svh] items-center justify-center gap-3 text-oh-mute">
          <Spinner />
          <span>{t("loading")}</span>
        </div>
      </StepSheet>
    );
  }

  const quoteCents = q.quote && !q.loading ? q.quote.totalCents : null;
  const dueCents = q.quote && !q.loading ? q.quote.amountDueCents : null;
  const quoteProblem = q.error && !(withSavings && ["REWARD_NOT_APPLICABLE", "REWARD_UNAVAILABLE"].includes(q.error.code || "")) ? orderErrorCode(q.error.code, q.status) : null;
  const alertCode = flowError?.code || quoteProblem;
  const alert = notice ? (
    <>{notice}</>
  ) : alertCode ? (
    <>
      {te(alertCode)}
      {flowError?.refunded ? <> {t("pay.refunded")}</> : null}
      {alertCode === "ARRIVAL_INVALID" || alertCode === "ORDERING_CLOSED" ? (
        <>
          {" "}
          <a href={hrefFor("arrival")} className="font-semibold text-oh-cream underline underline-offset-4">
            {t("arrival.change")}
          </a>
        </>
      ) : null}
    </>
  ) : null;

  const totalSummary = <TotalSummary label={t("total")} note={t("includesTax")} cents={quoteCents} format={money} />;

  if (step === "bowl") {
    return (
      <StepSheet
        step="bowl"
        title={t("bowl.title")}
        lede={groupCode ? t("bowl.groupLede", { code: groupCode }) : t("bowl.lede")}
        backHref={backHref}
        wide
        alert={alert}
        summary={totalSummary}
        cta={{
          label: groupCode ? t("bowl.addToGroup") : t("continue"),
          onClick: groupCode ? addToGroup : () => go("arrival"),
          disabled: !bowlComplete(draft, menu) || quoteCents === null,
          busy,
        }}
      >
        <BowlBuilder steps={menu} draft={draft} update={update} />
      </StepSheet>
    );
  }

  if (step === "arrival") {
    const opts = availability?.validArrivalTimes || [];
    const noTimes = availability !== null && (!availability.canOrder || opts.length === 0);
    return (
      <StepSheet
        step="arrival"
        title={t("arrival.title")}
        lede={t("arrival.lede")}
        backHref={backHref}
        alert={alert}
        summary={totalSummary}
        cta={noTimes ? null : { label: t("continue"), onClick: () => go("pod"), disabled: !draft.arrival || !availability }}
      >
        <div key="arrival" className="oh-step-in">
          {!availability ? (
            <div role="status" className="flex items-center gap-3 text-oh-mute">
              <Spinner />
              <span>{t("loading")}</span>
            </div>
          ) : noTimes ? (
            <ClosedPanel variant="hours" />
          ) : (
            <ArrivalPicker options={opts} value={draft.arrival} onChange={(v) => update((d) => ({ ...d, arrival: v }))} timeZone={location.timezone} preOrder={availability.preOrder} />
          )}
        </div>
      </StepSheet>
    );
  }

  if (step === "pod") {
    return (
      <StepSheet step="pod" title={t("pod.title")} lede={t("pod.lede")} backHref={backHref} alert={alert} summary={totalSummary} cta={{ label: t("continue"), onClick: () => go("savings") }}>
        <div key="pod" className="oh-step-in">
          <PodStep
            locationId={location.id}
            layoutKey={location.layoutKey}
            pod={draft.pod}
            partySize={draft.partySize}
            onPod={(pod) => update((d) => ({ ...d, pod }))}
            onPartySize={(n) => update((d) => ({ ...d, partySize: n }))}
          />
        </div>
      </StepSheet>
    );
  }

  // savings
  const receiptLines = receiptFor(menu, q.quote?.lines || [], q.quote?.discounts?.rewardCents || 0, draft.savings.rewardId);
  return (
    <StepSheet
      step="savings"
      title={t("savings.title")}
      lede={t("savings.lede")}
      backHref={backHref}
      wide
      alert={alert}
      summary={<TotalSummary label={t("due")} cents={dueCents} format={money} />}
      cta={{ label: dueCents === 0 ? t("continue") : t("savings.cta"), onClick: placeOrder, disabled: dueCents === null, busy }}
    >
      <div key="savings" className="oh-step-in">
        <SavingsStep
          locationId={location.id}
          userId={member.userId}
          api={api}
          savings={draft.savings}
          onSavings={(savings) => update((d) => ({ ...d, savings }))}
          quote={q.quote}
          quoteError={q.error}
          lines={receiptLines}
        />
      </div>
    </StepSheet>
  );
}

/**
 * Receipt lines from the quote's own lines: the soup (with its noodles as
 * detail) and every add-on, side, drink or dessert. Slider choices are free
 * and not listed. A reward shows on the line it covers (the server's
 * rewardCents, on the highest-priced qualifying line).
 */
function receiptFor(steps: MenuStep[], lines: { menuItemId: string; quantity: number; priceCents: number }[], rewardCents: number, rewardId: string | null): ReceiptLine[] {
  const info = new Map<string, { name: string; kind: "soup" | "noodles" | "extra" | "slider"; base: number }>();
  for (const s of steps) {
    for (const sec of s.sections) {
      if (sec.selectionMode === "SLIDER" && sec.item) info.set(sec.item.id, { name: sec.item.name, kind: "slider", base: 0 });
      for (const it of sec.items || []) info.set(it.id, { name: it.name, kind: sec.id === "soup" ? "soup" : sec.id === "noodles" ? "noodles" : "extra", base: it.basePriceCents });
    }
  }
  const noodles = lines.find((l) => info.get(l.menuItemId)?.kind === "noodles");
  const shown = lines.filter((l) => {
    const k = info.get(l.menuItemId)?.kind;
    return k === "soup" || k === "extra";
  });
  // Soup first, then extras in menu order.
  shown.sort((a, b) => Number(info.get(b.menuItemId)?.kind === "soup") - Number(info.get(a.menuItemId)?.kind === "soup"));
  // The reward is one unit of the highest-priced qualifying line at its base price
  // (pricing.js rewardDiscountCents): show it on the line whose price it matches.
  const rewarded = rewardId && rewardCents > 0 ? shown.find((l) => info.get(l.menuItemId)!.base === rewardCents || l.priceCents === rewardCents) : undefined;
  const out: ReceiptLine[] = shown.map((l) => {
    const i = info.get(l.menuItemId)!;
    return {
      key: l.menuItemId,
      label: i.name,
      detail: i.kind === "soup" ? (noodles ? info.get(noodles.menuItemId)?.name ?? null : null) : l.quantity > 1 ? `x${l.quantity}` : null,
      cents: l.priceCents,
      nowCents: rewarded === l ? Math.max(0, l.priceCents - rewardCents) : null,
      main: i.kind === "soup",
    };
  });
  return out;
}

