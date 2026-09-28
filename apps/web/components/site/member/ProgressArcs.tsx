"use client";

/**
 * Task D8: the climb. Two gold arcs (bowls and friends toward the next
 * tier) that draw in when they enter view, each with a CountUp, then a
 * preview of what the next tier brings, straight from the program. At the
 * top tier the arcs give way to a quiet "you're at the top" panel.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { CountUp } from "@/components/site/motion/CountUp";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { Eyebrow, Title } from "@/components/site/Text";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import type { PublicProgram } from "@/lib/site/simulate";
import { tierMeta } from "@/lib/site/tier-meta";
import type { PassportProfile, ProgressCount } from "./usePassport";

const R = 52;
const LEN = 2 * Math.PI * R * 0.75; // a 270-degree arc

function Arc({ kind, label, a11y, count }: { kind: "orders" | "referrals"; label: string; a11y: string; count: ProgressCount }) {
  const pct = count.need > 0 ? Math.min(1, count.have / count.need) : 1;
  const offset = LEN * (1 - pct);
  return (
    <div data-arc={kind} className="flex min-w-0 flex-1 flex-col items-center">
      <div
        role="progressbar"
        aria-label={a11y}
        aria-valuemin={0}
        aria-valuemax={count.need}
        aria-valuenow={Math.min(count.have, count.need)}
        className="relative h-36 w-36 md:h-44 md:w-44"
      >
        <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" style={{ ["--mp-arc-len" as string]: `${LEN}`, ["--mp-arc-offset" as string]: `${offset}` }}>
          <g transform="rotate(135 60 60)">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-oh-stone)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${LEN} 999`} />
            <circle className="mp-arc-fill" cx="60" cy="60" r={R} fill="none" stroke="var(--color-oh-gold)" strokeWidth="7" strokeLinecap="round" />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p data-arc-value className="m-0 font-display text-[2.4rem] leading-none tabular-nums text-oh-cream md:text-5xl">
            <CountUp to={count.have} duration={1100} />
            <span className="text-oh-cream/45">/{count.need}</span>
          </p>
        </div>
      </div>
      <p className="m-0 -mt-3 text-base font-semibold text-oh-cream">{label}</p>
    </div>
  );
}

export function ProgressArcs({ profile, program }: { profile: PassportProfile; program: PublicProgram }) {
  const t = useTranslations("passport.climb");
  const tn = useTranslations("passport.next");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const name = (key: string) => tiers(`${tierMeta(key).msg}.name`);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const { next, orders, referrals } = profile.progress;
  const nextRule = next ? program.tiers.find((x) => x.key === next) : null;
  const top = program.tiers[program.tiers.length - 1];

  if (!next || !nextRule) {
    return (
      <section aria-labelledby="climb-title" className="px-4 py-12 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="climb-title" locale={locale} className="m-0 mt-3 text-oh-cream">
            {t("titleTop")}
          </Title>
          <div className="mt-8 flex items-center gap-5 rounded-[1.5rem] border border-oh-gold/30 bg-oh-ink p-5 md:p-8">
            <span className="shrink-0 text-oh-gold">
              <TierMark tier={tierMeta(top.key).mark} tone="current" size={64} />
            </span>
            <p className="m-0 text-base leading-relaxed text-oh-cream/85 md:text-lg">{t("topBody", { pct: profile.cashbackPct })}</p>
          </div>
        </div>
      </section>
    );
  }

  const perks: string[] = [
    tn("cashback", { pct: nextRule.cashbackPct }),
    tn("freeBowl"),
    tn("earlyAccess", { days: nextRule.earlyAccessDays }),
  ];
  if (nextRule.queueBoost > 0) perks.push(tn("queue"));
  if (program.quarterlyPerk?.tier === nextRule.key) perks.push(tn("addon"));

  const moreOrders = Math.max(0, orders.need - orders.have);
  const moreReferrals = Math.max(0, referrals.need - referrals.have);

  return (
    <section aria-labelledby="climb-title" className="px-4 py-12 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <Title id="climb-title" locale={locale} className="m-0 mt-3 text-oh-cream">
          {t("title", { next: name(next) })}
        </Title>

        <div className="mt-8 grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
          <div>
            <div ref={ref} data-arcs-in={inView || reduced ? "true" : "false"} data-reduced={reduced ? "true" : "false"} className="flex gap-2">
              <Arc
                kind="orders"
                label={t("orders")}
                a11y={t("ordersA11y", { have: orders.have, need: orders.need, next: name(next) })}
                count={orders}
              />
              <Arc
                kind="referrals"
                label={t("referrals")}
                a11y={t("referralsA11y", { have: referrals.have, need: referrals.need, next: name(next) })}
                count={referrals}
              />
            </div>
            <p className="m-0 mt-6 text-center text-base text-oh-cream/80">
              {profile.progress.ready ? t("ready") : t("remaining", { orders: moreOrders, referrals: moreReferrals })}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-oh-stone/80 bg-oh-ink p-5 md:p-7">
            <div className="flex items-center gap-4">
              <span className="shrink-0 text-oh-gold">
                <TierMark tier={tierMeta(next).mark} tone="current" size={48} />
              </span>
              <h3 className="m-0 text-lg font-semibold text-oh-cream">{tn("title", { next: name(next) })}</h3>
            </div>
            <ul className="m-0 mt-4 grid list-none gap-3 p-0">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-base text-oh-cream/85">
                  <Icon name="check" size={18} className="mt-1 shrink-0 text-oh-gold" />
                  <span className="min-w-0">{perk}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`${localizedHref(locale, "/rewards")}#climb`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-ember-light no-underline hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("guide")}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
