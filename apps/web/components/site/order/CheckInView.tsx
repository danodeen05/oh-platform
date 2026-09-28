"use client";

/**
 * Check in (Task D6): the kiosk step from the guest's phone. The order code
 * comes from the link (confirmation page) or is typed; POST /orders/check-in
 * assigns the pod (or a place in line) and the guest goes on to the status
 * page. "Already checked in" counts as success, as before. The API's own
 * error text is English, so the page shows its own translated message for
 * each outcome instead.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Display, Eyebrow } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { trackCheckIn } from "@/lib/analytics";
import { SITE_API_URL } from "@/lib/site/api";
import { PRIMARY } from "./PodCard";
import { Spinner } from "./StepSheet";
import { TENANT } from "./useOrderStatus";

export const INPUT_CLASS =
  "block min-h-12 w-full rounded-2xl border-0 bg-oh-charcoal px-4 py-3 font-mono text-base text-oh-cream ring-1 ring-inset ring-oh-stone placeholder:text-oh-mute focus:outline-2 focus:outline-offset-2 focus:outline-oh-cream aria-[invalid=true]:ring-oh-ember-light";

/** A translated message key for a failed check-in or pod confirm (the API's error strings are English). */
export function failureKey(status: number, error: string | undefined): "notFound" | "notPaid" | "noPod" | "failed" {
  if (status === 404) return "notFound";
  if (/paid/i.test(error || "")) return "notPaid";
  if (/no pod/i.test(error || "")) return "noPod";
  return "failed";
}

export function CheckInView({ initialCode }: { initialCode: string | null }) {
  const t = useTranslations("afterOrder.checkIn");
  const tc = useTranslations("afterOrder.common");
  const locale = useLocale();
  const router = useRouter();
  const [code, setCode] = useState(initialCode || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const qr = code.trim();
    if (!qr) {
      setError(t("required"));
      return;
    }
    setBusy(true);
    setError(null);
    const toStatus = () => router.push(`/${locale}/order/status?orderQrCode=${encodeURIComponent(qr)}`);
    try {
      const res = await fetch(`${SITE_API_URL}/orders/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...TENANT },
        body: JSON.stringify({ orderQrCode: qr }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        trackCheckIn({ orderId: data.orderId || data.order?.id || qr, locationId: data.locationId || data.order?.locationId || "", arrivalDeviation: data.arrivalDeviation });
        toStatus();
        return;
      }
      if (/already checked in/i.test(data?.error || "")) {
        toStatus();
        return;
      }
      setError(t(failureKey(res.status, data?.error)));
    } catch {
      setError(tc("networkError"));
    }
    setBusy(false);
  }

  return (
    <div data-checkin-page className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--dock-h,0px)+2.5rem)] pt-4 md:pt-12">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-oh-ember-deep text-oh-cream">
          <Icon name="qr" size={32} />
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

      <ol className="m-0 mt-6 list-none space-y-3 p-0">
        {(["one", "two", "three"] as const).map((k, i) => (
          <li key={k} className="flex gap-3 text-[15px] leading-relaxed text-oh-cream">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oh-ink text-sm font-semibold text-oh-ember-light ring-1 ring-oh-stone">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{t(`steps.${k}`)}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} noValidate className="mt-7 rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
        <label htmlFor="checkin-code" className="block text-[15px] font-semibold text-oh-cream">
          {t("codeLabel")}
        </label>
        <p id="checkin-hint" className="m-0 mt-1 text-sm text-oh-mute">
          {t("codeHint")}
        </p>
        <input
          id="checkin-code"
          name="orderQrCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={error ? "checkin-hint checkin-error" : "checkin-hint"}
          aria-invalid={error ? "true" : "false"}
          className={`${INPUT_CLASS} mt-3`}
        />
        {error ? (
          <p id="checkin-error" role="alert" className="m-0 mt-3 flex items-start gap-2 text-[15px] text-oh-cream">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-oh-ember-light" />
            {error}
          </p>
        ) : null}
        <button type="submit" data-checkin-submit disabled={busy} aria-busy={busy ? "true" : "false"} className={`${PRIMARY} mt-4 h-14`}>
          {busy ? <Spinner /> : null}
          {busy ? t("checking") : t("submit")}
        </button>
      </form>
      <p className="m-0 mt-5 text-sm leading-relaxed text-oh-mute">{t("help")}</p>
    </div>
  );
}
