"use client";

/**
 * Task G3 fix round 1: an old pod sticker (a pre-comb seat retired at the
 * release-2 cutover) is not an error. The guest is told the code is out of
 * date and offered the kiosk or choosing a pod in the order flow.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";

export function RetiredPodNotice({ locationName, orderQrCode }: { locationName?: string | null; orderQrCode?: string | null }) {
  const t = useTranslations("podCode");
  const locale = useLocale();
  return (
    <main className="flex min-h-svh items-center justify-center bg-oh-ink px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <section role="status" className="w-full max-w-sm rounded-2xl bg-oh-charcoal p-6 text-oh-cream">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-oh-ink text-oh-ember-light">
          <Icon name="pod" size={28} />
        </span>
        <h1 className="m-0 text-2xl leading-tight [overflow-wrap:anywhere]">{t("title")}</h1>
        {locationName ? <p className="m-0 mt-1 text-sm text-oh-mute">{locationName}</p> : null}
        <p className="m-0 mt-3 text-base leading-snug text-oh-cream/85 [overflow-wrap:anywhere]">{t("body")}</p>
        <p className="m-0 mt-2 text-base leading-snug text-oh-cream/85 [overflow-wrap:anywhere]">{t("kiosk")}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/${locale}/order`}
            className="flex min-h-11 items-center justify-center rounded-xl bg-oh-ember-deep px-4 text-center text-base font-semibold text-oh-cream no-underline"
          >
            {t("choose")}
          </Link>
          {orderQrCode ? (
            <Link
              href={`/${locale}/order/status?orderQrCode=${encodeURIComponent(orderQrCode)}`}
              className="flex min-h-11 items-center justify-center rounded-xl border border-oh-cream/30 px-4 text-center text-base text-oh-cream no-underline"
            >
              {t("status")}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
