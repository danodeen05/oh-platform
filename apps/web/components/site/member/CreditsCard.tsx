"use client";

/**
 * Task D8: credit on the passport. The balance (counted up), how it's
 * earned, and an expiring-soon alert built from the engine's expiring lots
 * (the amount due to lapse and the soonest date). Links to the history.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CountUp } from "@/components/site/motion/CountUp";
import { Eyebrow, Title } from "@/components/site/Text";
import { localizedHref } from "@/lib/site/nav";
import { formatDate, formatMoney } from "./format";
import type { ExpiringLot } from "./usePassport";

export function ExpiringAlert({ lots }: { lots: ExpiringLot[] }) {
  const t = useTranslations("passport.credits");
  const locale = useLocale();
  if (lots.length === 0) return null;
  const amount = lots.reduce((sum, l) => sum + l.remainingCents, 0);
  const soonest = lots.map((l) => l.expiresAt).sort()[0];
  return (
    <div data-expiring-alert role="note" className="flex items-start gap-3 rounded-2xl border border-oh-ember-light/50 bg-oh-ember-deep/20 p-4">
      <Icon name="alert" size={22} className="mt-0.5 shrink-0 text-oh-ember-light" />
      <p className="m-0 text-base leading-relaxed text-oh-cream">
        {t("expiring", { amount: formatMoney(amount, locale), date: formatDate(soonest, locale) })}
      </p>
    </div>
  );
}

export function CreditsCard({
  creditsCents,
  cashbackPct,
  expiring,
  expiryDays,
}: {
  creditsCents: number;
  cashbackPct: number;
  expiring: ExpiringLot[];
  expiryDays: number;
}) {
  const t = useTranslations("passport.credits");
  const locale = useLocale();

  return (
    <section aria-labelledby="credits-title" className="px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <Title id="credits-title" locale={locale} className="m-0 mt-3 text-oh-cream">
          {t("title")}
        </Title>
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div className="rounded-[1.5rem] border border-oh-stone/80 bg-oh-ink p-5 md:p-7">
            <p className="m-0 text-sm text-oh-cream/70">{t("balanceLabel")}</p>
            <p data-credits-balance className="m-0 mt-1 font-display text-[3.25rem] leading-none tabular-nums text-oh-gold">
              <CountUp to={creditsCents} duration={1000} format={(v) => formatMoney(Math.round(v), locale)} />
            </p>
            <p className="m-0 mt-3 text-base text-oh-cream/80">{t("earn", { pct: cashbackPct })}</p>
            <p className="m-0 mt-1 text-sm text-oh-cream/65">{t("lasts", { days: expiryDays })}</p>
            <Link
              href={localizedHref(locale, "/member/credits")}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-ember-light no-underline hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("history")}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <ExpiringAlert lots={expiring} />
        </div>
      </div>
    </section>
  );
}
