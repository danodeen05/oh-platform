"use client";

/**
 * Task D8: the passport cover. The member's tier mark in gold on the night
 * ink, their name, member number (the referral code) and joined date, and
 * three stamps: credit back, the day streak and bowls to date. The primary
 * CTA sits under it: "Use your free bowl" when one is waiting, else "Order
 * a bowl".
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Display, Eyebrow } from "@/components/site/Text";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import { tierMeta } from "@/lib/site/tier-meta";
import { formatMonthYear } from "./format";
import type { PassportProfile } from "./usePassport";

function Stamp({ label, value, attr }: { label: string; value: string; attr?: Record<string, string> }) {
  return (
    <div className="min-w-0 flex-1 text-center" {...attr}>
      <p className="m-0 font-display text-[1.75rem] leading-none tabular-nums text-oh-cream">{value}</p>
      <p className="m-0 mt-1.5 text-xs leading-snug text-oh-cream/70">{label}</p>
    </div>
  );
}

export function Passport({ profile, hasFreeBowl }: { profile: PassportProfile; hasFreeBowl: boolean }) {
  const t = useTranslations("passport");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const meta = tierMeta(profile.tier);
  const tierName = tiers(`${meta.msg}.name`);

  return (
    <section aria-labelledby="passport-title" className="px-4 pt-4 md:px-8 md:pt-10">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-12">
        <div
          data-passport-cover
          className="mp-cover relative overflow-hidden rounded-[1.75rem] p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] ring-1 ring-oh-gold/30 md:p-8"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[1.4rem] ring-1 ring-oh-gold/15" />
          <div className="relative flex items-start justify-between gap-3">
            <Eyebrow locale={locale} className="text-oh-gold">
              {t("cover.eyebrow")}
            </Eyebrow>
            {profile.referralCode ? (
              <p data-member-code className="m-0 shrink-0 font-mono text-xs tracking-[0.18em] text-oh-cream/60">
                {t("cover.number", { code: profile.referralCode })}
              </p>
            ) : null}
          </div>

          <div className="relative mt-6 flex items-center gap-5">
            <div className="mp-foil flex aspect-square w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full text-oh-gold ring-1 ring-oh-gold/40 min-[380px]:w-[6.25rem]">
              <TierMark tier={meta.mark} tone="current" size={64} className="h-[70%] w-[70%]" />
            </div>
            <div className="min-w-0">
              <p className="m-0 text-sm text-oh-cream/70">{t("cover.tierLabel")}</p>
              <Display
                id="passport-title"
                as="h1"
                locale={locale}
                className={`m-0 mt-1 text-oh-gold ${cjk ? "text-[2rem]" : "text-[2.35rem]"} leading-[1.05] md:text-[2.75rem]`}
              >
                {tierName}
              </Display>
              {profile.name ? (
                <p data-member-name className="m-0 mt-2 truncate text-base font-semibold text-oh-cream">
                  {profile.name}
                </p>
              ) : null}
              {profile.joinedAt ? (
                <p className="m-0 mt-0.5 text-sm text-oh-cream/65">{t("cover.since", { date: formatMonthYear(profile.joinedAt, locale) })}</p>
              ) : null}
            </div>
          </div>

          <div aria-hidden="true" className="mp-cover-rule relative mt-6 h-px" />

          <div className="relative mt-5 flex gap-2">
            <Stamp label={t("cover.cashback")} value={`${profile.cashbackPct}%`} />
            <Stamp
              label={t("cover.streak", { best: profile.longestStreak })}
              value={String(profile.currentStreak)}
              attr={{ "data-streak": String(profile.currentStreak) }}
            />
            <Stamp label={t("cover.bowls")} value={String(profile.lifetimeOrderCount)} />
          </div>
        </div>

        <div className="md:px-2">
          <p className="m-0 text-lg leading-relaxed text-oh-cream/85 md:text-xl">
            {hasFreeBowl ? t("cover.leadFreeBowl") : t("cover.lead", { pct: profile.cashbackPct })}
          </p>
          <Link
            href={localizedHref(locale, "/order")}
            data-passport-cta
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline shadow-[0_10px_30px_-12px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream sm:w-auto"
          >
            {hasFreeBowl ? t("cta.freeBowl") : t("cta.order")}
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
