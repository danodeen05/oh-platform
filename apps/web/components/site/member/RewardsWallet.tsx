"use client";

/**
 * Task D8: the rewards wallet. Each active reward (FREE_BOWL,
 * PREMIUM_ADDON) is a linen ticket with a live countdown to `windowEndsAt`
 * (days, then hours in the last day) and a "Use it" link into the order
 * builder, where the reward is redeemed. Soonest-ending first.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Eyebrow, Title } from "@/components/site/Text";
import { localizedHref } from "@/lib/site/nav";
import { tierMeta } from "@/lib/site/tier-meta";
import { formatDate } from "./format";
import { countdown } from "./moments";
import type { MemberReward, PassportProfile } from "./usePassport";

/** Re-renders every minute so countdowns stay honest on a phone left open. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Ticket({ reward, now, index }: { reward: MemberReward; now: Date; index: number }) {
  const t = useTranslations("passport.rewards");
  const locale = useLocale();
  const kind = reward.type === "PREMIUM_ADDON" ? "PREMIUM_ADDON" : "FREE_BOWL";
  const left = countdown(reward.windowEndsAt, now);
  const leftText = left.unit === "ended" ? t("ended") : t(left.unit, { count: left.value });
  const urgent = left.unit !== "days" || left.value <= 3;

  return (
    <Reveal as="li" delay={index * 90} data-reward={kind} className="mp-ticket flex min-w-0 overflow-hidden rounded-2xl text-oh-ink">
      <div className="flex min-w-0 flex-1 flex-col px-6 py-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-ember-deep">{t(`${kind}.name`)}</p>
        <p className="m-0 mt-1.5 font-display text-2xl leading-tight text-oh-ink">{t(`${kind}.body`)}</p>
        <p className="m-0 mt-2 text-sm text-oh-ink/80">{t("useBy", { date: formatDate(reward.windowEndsAt, locale) })}</p>
      </div>
      <div aria-hidden="true" className="mp-ticket-rule my-4 w-px shrink-0" />
      <div className="flex w-[7.5rem] shrink-0 flex-col items-center justify-center gap-3 px-3 py-5 text-center">
        <p data-reward-countdown className={`m-0 text-sm font-semibold leading-snug ${urgent ? "text-oh-ember-deep" : "text-oh-ink/85"}`}>
          {leftText}
        </p>
        <Link
          href={localizedHref(locale, "/order")}
          data-reward-cta
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-oh-ember-deep px-4 text-sm font-semibold text-oh-cream no-underline transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-ink"
        >
          {t("use")}
          <span className="sr-only">{`: ${t(`${kind}.name`)}`}</span>
        </Link>
      </div>
    </Reveal>
  );
}

export function RewardsWallet({ profile }: { profile: PassportProfile }) {
  const t = useTranslations("passport.rewards");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const now = useNow();
  const rewards = profile.rewards
    .filter((r) => new Date(r.windowEndsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.windowEndsAt).getTime() - new Date(b.windowEndsAt).getTime());
  const next = profile.progress.next;

  return (
    <section aria-labelledby="rewards-title" className="px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <Title id="rewards-title" locale={locale} className="m-0 mt-3 text-oh-cream">
          {t("title")}
        </Title>
        {rewards.length === 0 ? (
          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-dashed border-oh-stone p-5">
            <Icon name="gift" size={28} className="shrink-0 text-oh-gold" />
            <p className="m-0 text-base leading-relaxed text-oh-cream/80">
              {next ? t("empty", { next: tiers(`${tierMeta(next).msg}.name`) }) : t("emptyTop")}
            </p>
          </div>
        ) : (
          <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2">
            {rewards.map((r, i) => (
              <Ticket key={r.id} reward={r} now={now} index={i} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
