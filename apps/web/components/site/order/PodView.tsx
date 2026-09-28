"use client";

/**
 * The pod page (Task D6): what a guest sees after scanning the QR code on a
 * pod's table (/{locale}/pod?qr=POD-...). The live comb map (`CombMap
 * mode="live"`, fed by `useSeats`) shows where the pod is, highlighted; with
 * the guest's paid order waiting there, "I'm here" confirms their arrival
 * (POST /pods/confirm-arrival, matched to the signed-in member) and the page
 * moves on to the order's status. A free pod explains how to get it.
 *
 * Every string is translated (the legacy page was English only), including
 * the failures, which the API reports in English.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Display, Eyebrow } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { useSeats } from "@/components/site/floor-plan/useSeats";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { useSiteApi, SITE_API_URL } from "@/lib/site/api";
import { PRIMARY, SECONDARY } from "./PodCard";
import { Spinner } from "./StepSheet";
import { TENANT } from "./useOrderStatus";
import "./after-order.css";

// The map is the page's centerpiece but not its first paint: load it on the client, after the words.
const CombMap = dynamic(() => import("@/components/site/floor-plan/CombMap").then((m) => m.CombMap), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-oh-ink motion-reduce:animate-none md:aspect-[16/10]" />,
});

interface PodInfo {
  pod: { id: string; number: string; label?: string | null; qrCode: string; status: string };
  location: { id: string; name: string; city?: string | null };
  hasActiveOrder: boolean;
  activeOrder: { id: string; orderNumber: string; kitchenOrderNumber: string | null; orderQrCode: string; alreadyConfirmed: boolean } | null;
}

export function PodView({ qr }: { qr: string | null }) {
  const t = useTranslations("afterOrder.pod");
  const tc = useTranslations("afterOrder.common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const api = useSiteApi();
  const [info, setInfo] = useState<PodInfo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "none">(qr ? "loading" : "none");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seats = useSeats(info?.location.id ?? null, { apiBase: SITE_API_URL, refreshMs: 15_000 });
  const statusHref = (code: string) => `/${locale}/order/status?orderQrCode=${encodeURIComponent(code)}`;

  useEffect(() => {
    if (!qr) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${SITE_API_URL}/pods/info?qrCode=${encodeURIComponent(qr)}&locale=${encodeURIComponent(locale)}`, { headers: TENANT, cache: "no-store" });
        if (!live) return;
        if (!res.ok) {
          setState("error");
          return;
        }
        const data: PodInfo = await res.json();
        setInfo(data);
        setState("ready");
        // Already confirmed here: the order's own page is the place to be.
        if (data.activeOrder?.alreadyConfirmed && data.activeOrder.orderQrCode) router.replace(statusHref(data.activeOrder.orderQrCode));
      } catch {
        if (live) setState("error");
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, locale]);

  async function imHere() {
    if (!qr || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The API matches the signed-in member's order at this pod from the verified session.
      const res = await api(`${SITE_API_URL}/pods/confirm-arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...TENANT },
        body: JSON.stringify({ podQrCode: qr }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConfirmed(true);
        const code = data?.order?.orderQrCode || info?.activeOrder?.orderQrCode;
        setTimeout(() => (code ? router.push(statusHref(code)) : undefined), 1500);
        return;
      }
      setError(res.status === 404 ? t("noOrder") : /match/i.test(data?.error || "") ? t("notYours") : /already/i.test(data?.error || "") ? t("already") : t("failed"));
    } catch {
      setError(tc("networkError"));
    }
    setBusy(false);
  }

  const label = info?.pod.label || info?.pod.number || "";
  const mapKey = seats.layoutKey;
  const combLabels = tRoot.raw("combMap") as CombMapLabels;

  if (state === "none" || state === "error") {
    return (
      <div data-pod-page data-state={state} className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col items-start justify-center gap-4 px-4 py-10">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-oh-ink text-oh-ember-light ring-1 ring-oh-stone">
          <Icon name={state === "error" ? "alert" : "qr"} size={30} />
        </span>
        <Display locale={locale} className="m-0 !text-[clamp(2rem,8vw,3rem)] text-oh-cream">
          {state === "error" ? t("error") : t("noCode")}
        </Display>
        <p className="m-0 text-base leading-relaxed text-oh-mute">{state === "error" ? t("errorLede") : t("noCodeLede")}</p>
        <Link href={`/${locale}/order`} className={PRIMARY}>
          {tc("newOrder")}
        </Link>
      </div>
    );
  }

  if (state === "loading" || !info) {
    return (
      <div data-pod-page data-state="loading" role="status" className="mx-auto flex min-h-[60svh] w-full max-w-xl items-center justify-center gap-2.5 px-4 text-[15px] text-oh-mute">
        <Spinner />
        {tc("loading")}
      </div>
    );
  }

  if (confirmed) {
    return (
      <div data-pod-page data-state="confirmed" role="status" className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col items-start justify-center gap-4 px-4 py-10">
        <span aria-hidden="true" className="oh-mark-in flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream">
          <Icon name="check" size={32} />
        </span>
        <Display locale={locale} className="m-0 !text-[clamp(2rem,8vw,3rem)] text-oh-cream">
          {t("confirmed", { label })}
        </Display>
        <p className="m-0 text-base text-oh-mute">{t("confirmedLede")}</p>
      </div>
    );
  }

  const order = info.activeOrder;
  return (
    <div data-pod-page data-state="ready" className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--dock-h,0px)+2.5rem)] pt-4 md:max-w-6xl md:px-8 md:pt-10">
      <div className="md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream">
              <Icon name="pod" size={32} />
            </span>
            <div className="min-w-0 flex-1">
              <Eyebrow locale={locale} as="p" className="m-0 !normal-case !tracking-normal text-oh-mute">
                {info.location.name}
              </Eyebrow>
              <Display locale={locale} className="m-0 mt-1.5 !text-[clamp(2.1rem,8vw,3.25rem)] text-oh-cream">
                {t("title", { label })}
              </Display>
            </div>
          </div>

          {info.hasActiveOrder && order && !order.alreadyConfirmed ? (
            <section aria-labelledby="pod-order" className="rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
              <h2 id="pod-order" className="m-0 text-lg font-semibold text-oh-cream">
                {t("waiting")}
              </h2>
              <p className="m-0 mt-1 text-[15px] leading-relaxed text-oh-mute">{t("waitingLede", { number: order.kitchenOrderNumber || order.orderNumber.slice(-6) })}</p>
              {error ? (
                <p role="alert" className="m-0 mt-3 flex items-start gap-2 text-[15px] text-oh-cream">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
                  {error}
                </p>
              ) : null}
              <button type="button" data-pod-confirm-arrival onClick={imHere} disabled={busy} aria-busy={busy ? "true" : "false"} className={`${PRIMARY} mt-4 h-14`}>
                {busy ? <Spinner /> : <Icon name="check" size={20} />}
                {busy ? t("confirming") : t("confirm")}
              </button>
            </section>
          ) : !info.hasActiveOrder ? (
            <section aria-labelledby="pod-free" className="rounded-[1.75rem] bg-oh-linen px-5 py-5 text-oh-charcoal">
              <h2 id="pod-free" className="m-0 text-lg font-semibold">
                {t("free")}
              </h2>
              <ol className="m-0 mt-3 list-none space-y-2.5 p-0">
                {(["one", "two", "three"] as const).map((k, i) => (
                  <li key={k} className="flex gap-3 text-[15px] leading-relaxed">
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oh-charcoal text-xs font-semibold text-oh-linen">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{t(`freeSteps.${k}`)}</span>
                  </li>
                ))}
              </ol>
              <Link href={`/${locale}/order`} className={`${PRIMARY} mt-4`}>
                <Icon name="bowl" size={20} />
                {tc("newOrder")}
              </Link>
            </section>
          ) : null}
        </div>

        <section aria-labelledby="pod-map-title" className="mt-6 md:mt-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="pod-map-title" className="m-0 text-lg font-semibold text-oh-cream">
              {t("mapTitle")}
            </h2>
            <span className="text-sm text-oh-mute">{t("mapHint", { label })}</span>
          </div>
          {mapKey ? (
            <CombMap layoutKey={mapKey} mode="live" labels={combLabels} seats={seats.seats} selected={label} tone="night" />
          ) : seats.status === "error" ? (
            <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-mute ring-1 ring-oh-stone">{t("mapError")}</p>
          ) : seats.status === "ready" ? null : (
            <div aria-hidden="true" className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-oh-ink motion-reduce:animate-none md:aspect-[16/10]" />
          )}
        </section>

        {!info.hasActiveOrder || !order ? null : (
          <Link href={`/${locale}/member`} className={`${SECONDARY} mt-6 md:hidden`}>
            <Icon name="user" size={20} />
            {t("account")}
          </Link>
        )}
      </div>
    </div>
  );
}
