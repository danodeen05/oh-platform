"use client";

/**
 * Confirm at the pod (Task D6): the guest is at their pod and says so.
 * Reads the order (GET /orders/status) for its pod; a pod already confirmed
 * goes straight to the status page. POST /orders/confirm-pod starts the
 * kitchen on it. Same QR and pod logic as before, new look, and translated
 * messages in place of the API's English ones.
 */
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Display, Eyebrow } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { SITE_API_URL } from "@/lib/site/api";
import { podLabelOf } from "@/lib/site/order-status";
import { PodCard, PRIMARY, SECONDARY } from "./PodCard";
import { Spinner } from "./StepSheet";
import { TENANT } from "./useOrderStatus";
import { INPUT_CLASS, failureKey } from "./CheckInView";

export function ScanView({ initialCode }: { initialCode: string | null }) {
  const t = useTranslations("afterOrder.scan");
  const tc = useTranslations("afterOrder.common");
  const locale = useLocale();
  const router = useRouter();
  const [code, setCode] = useState(initialCode || "");
  const [pod, setPod] = useState<string | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "missing">(initialCode ? "loading" : "ready");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ text: string; checkIn?: boolean } | null>(null);
  const statusHref = (qr: string) => `/${locale}/order/status?orderQrCode=${encodeURIComponent(qr)}`;

  useEffect(() => {
    if (!initialCode) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${SITE_API_URL}/orders/status?orderQrCode=${encodeURIComponent(initialCode)}&locale=${encodeURIComponent(locale)}`, { headers: TENANT, cache: "no-store" });
        if (!live) return;
        if (!res.ok) {
          setLoad("missing");
          return;
        }
        const data = await res.json();
        if (data?.order?.podConfirmedAt) {
          router.replace(statusHref(initialCode));
          return;
        }
        setPod(podLabelOf(data?.order));
        setLoad("ready");
      } catch {
        if (live) setLoad("missing");
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, locale]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const qr = code.trim();
    if (!qr) {
      setError({ text: t("required") });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${SITE_API_URL}/orders/confirm-pod`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...TENANT },
        body: JSON.stringify({ orderQrCode: qr }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || /already confirmed/i.test(data?.error || "")) {
        setDone(true);
        setTimeout(() => router.push(statusHref(qr)), 1200);
        return;
      }
      const key = failureKey(res.status, data?.error);
      setError({ text: t(key), checkIn: key === "noPod" });
    } catch {
      setError({ text: tc("networkError") });
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div data-scan-page data-state="done" role="status" className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col items-start justify-center gap-4 px-4 py-10">
        <span aria-hidden="true" className="oh-mark-in flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream">
          <Icon name="check" size={32} />
        </span>
        <Display locale={locale} className="m-0 !text-[clamp(2.1rem,8vw,3.25rem)] text-oh-cream">
          {t("success")}
        </Display>
        <p className="m-0 text-base text-oh-mute">{t("successLede")}</p>
      </div>
    );
  }

  return (
    <div data-scan-page data-state={load} className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--dock-h,0px)+2.5rem)] pt-4 md:pt-12">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream">
          <Icon name="pod" size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow locale={locale} as="p" className="m-0 text-oh-mute">
            {t("eyebrow")}
          </Eyebrow>
          <Display locale={locale} className="m-0 mt-1.5 !text-[clamp(2.1rem,8vw,3.25rem)] text-oh-cream">
            {t("title")}
          </Display>
        </div>
      </div>
      <p className="m-0 mt-3 max-w-prose text-base leading-relaxed text-oh-mute">{t("lede")}</p>

      <div className="mt-6">
        {load === "loading" ? (
          <p role="status" className="m-0 flex items-center gap-2.5 text-[15px] text-oh-mute">
            <Spinner />
            {tc("loading")}
          </p>
        ) : load === "missing" ? (
          <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-mute ring-1 ring-oh-stone">{t("notFound")}</p>
        ) : pod ? (
          <PodCard label={pod} note={t("podNote")} />
        ) : initialCode ? (
          <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] text-oh-mute ring-1 ring-oh-stone">{t("noPod")}</p>
        ) : null}
      </div>

      <form onSubmit={submit} noValidate className="mt-5 rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
        <label htmlFor="scan-code" className="block text-[15px] font-semibold text-oh-cream">
          {t("codeLabel")}
        </label>
        <p id="scan-hint" className="m-0 mt-1 text-sm text-oh-mute">
          {t("codeHint")}
        </p>
        <input
          id="scan-code"
          name="orderQrCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={error ? "scan-hint scan-error" : "scan-hint"}
          aria-invalid={error ? "true" : "false"}
          className={`${INPUT_CLASS} mt-3`}
        />
        {error ? (
          <div id="scan-error" role="alert" className="mt-3 text-[15px] text-oh-cream">
            <p className="m-0 flex items-start gap-2">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
              {error.text}
            </p>
            {error.checkIn && code.trim() ? (
              <Link href={`/${locale}/order/check-in?orderQrCode=${encodeURIComponent(code.trim())}`} className={`${SECONDARY} mt-3`}>
                {t("checkInFirst")}
              </Link>
            ) : null}
          </div>
        ) : null}
        <button type="submit" data-scan-submit disabled={busy} aria-busy={busy ? "true" : "false"} className={`${PRIMARY} mt-4 h-14`}>
          {busy ? <Spinner /> : <Icon name="pod" size={20} />}
          {busy ? t("confirming") : t("submit")}
        </button>
      </form>

      {code.trim() ? (
        <Link href={statusHref(code.trim())} className="mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] text-oh-mute underline decoration-oh-stone underline-offset-4 hover:text-oh-cream">
          {t("back")}
        </Link>
      ) : null}
    </div>
  );
}
