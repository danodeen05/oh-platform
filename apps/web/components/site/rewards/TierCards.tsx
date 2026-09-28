"use client";

/**
 * Task D7: the tier cards, in a SnapRail. Tap a card to flip it to its
 * perks: cashback, early access, kitchen queue priority, the free bowl on
 * arrival and, at the top tier, the quarterly premium add-on. Every number
 * comes from the program.
 *
 * The flip is a real toggle button (aria-pressed) laid over the card; the
 * hidden face is aria-hidden and inert, so assistive tech reads one face at
 * a time. Reduced motion swaps faces with no rotation.
 *
 * The top tier wears a gold foil: a conic-gradient sheen whose angle follows
 * --progress (rewards.css; useScrollVars is the fallback).
 */
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { SnapRail } from "@/components/site/motion/SnapRail";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { TierMark } from "@/components/site/tiers/TierMark";
import type { ProgramTier, PublicProgram } from "@/lib/site/program";
import { tierMeta } from "@/lib/site/tier-meta";
import { coverProgress, useScrollVars } from "./useScrollVars";
import "./rewards.css";

function measureFoil(el: HTMLElement, viewport: number) {
  el.style.setProperty("--progress", coverProgress(el.getBoundingClientRect(), viewport, 0, 1).toFixed(3));
}

const TONES = [
  { mark: "text-oh-cream/80", ring: "border-oh-stone" },
  { mark: "text-oh-cream", ring: "border-oh-cream/30" },
  { mark: "text-oh-gold", ring: "border-oh-gold/60" },
];

function Card({ program, tier, index }: { program: PublicProgram; tier: ProgramTier; index: number }) {
  const t = useTranslations("rewards.tiers");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const foilRef = useRef<HTMLDivElement | null>(null);
  const isTop = index === program.tiers.length - 1;
  useScrollVars(foilRef, measureFoil, isTop && !reduced);

  const meta = tierMeta(tier.key);
  const name = tiers(`${meta.msg}.name`);
  const tone = TONES[Math.min(index, TONES.length - 1)];
  const serif = cjk ? "font-display-cjk" : "font-display";

  const perks: string[] = [t("perks.cashback", { pct: tier.cashbackPct }), t("perks.earlyAccess", { days: tier.earlyAccessDays })];
  perks.push(tier.queueBoost > 0 ? (isTop ? t("perks.queueTop") : t("perks.queue")) : t("perks.queueNone"));
  if (index > 0) perks.push(t("perks.freeBowl", { tier: name, days: program.upgradeRewardWindowDays }));
  if (program.quarterlyPerk?.tier === tier.key) perks.push(t("perks.quarterly"));

  const face = "rw-face absolute inset-0 flex flex-col overflow-hidden rounded-[1.75rem] border p-6";

  return (
    <article
      data-tier-card={tier.key}
      data-flipped={flipped ? "true" : "false"}
      data-reduced={reduced ? "true" : "false"}
      aria-label={name}
      className="rw-card relative h-[28rem] w-[min(80vw,20rem)] md:w-[calc((100%-3rem)/3)]"
    >
      <div className="rw-card-inner relative h-full w-full">
        {/* Front */}
        <div
          ref={isTop ? foilRef : undefined}
          data-tier-front
          aria-hidden={flipped}
          inert={flipped}
          data-static={reduced ? "true" : "false"}
          className={`${face} ${tone.ring} ${isTop ? "rw-foil bg-[radial-gradient(120%_90%_at_20%_0%,color-mix(in_oklab,var(--color-oh-gold)_16%,var(--color-oh-ink))_0%,var(--color-oh-ink)_62%)]" : "bg-oh-ink"} ${
            reduced && flipped ? "invisible" : ""
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oh-mute">{index + 1} / {program.tiers.length}</span>
          <span className={`mt-auto ${tone.mark}`}>
            <TierMark tier={meta.mark} tone="current" size={112} />
          </span>
          <h3 className={`${serif} m-0 mt-6 text-4xl font-normal leading-tight text-oh-cream`}>{name}</h3>
          <p className={`m-0 mt-1 text-2xl font-semibold ${isTop ? "text-oh-gold" : "text-oh-cream/85"}`}>
            {t("headline", { pct: tier.cashbackPct })}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm text-oh-cream/65">
            {t("tapHint")}
            <Icon name="arrow" size={16} />
          </span>
        </div>

        {/* Back: the perks */}
        <div
          data-tier-back
          aria-hidden={!flipped}
          inert={!flipped}
          className={`${face} rw-face-back overflow-y-auto overscroll-contain ${tone.ring} bg-oh-stone/95 ${reduced && !flipped ? "invisible" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className={tone.mark}>
              <TierMark tier={meta.mark} tone="current" size={36} />
            </span>
            <h3 className={`${serif} m-0 text-[1.375rem] font-normal leading-tight text-oh-cream`}>{t("perksTitle", { tier: name })}</h3>
          </div>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-oh-cream">
                <Icon name="check" size={20} className={`mt-0.5 shrink-0 ${isTop ? "text-oh-gold" : "text-oh-olive-light"}`} />
                <span className="min-w-0">{perk}</span>
              </li>
            ))}
          </ul>
          <span className="mt-auto pt-4 text-sm text-oh-cream/65">{t("backHint")}</span>
        </div>
      </div>

      {/* The flip toggle covers the whole card: one big, obvious tap target. */}
      <button
        type="button"
        data-tier-flip
        aria-pressed={flipped}
        aria-label={t("flip", { tier: name })}
        onClick={() => setFlipped((f) => !f)}
        className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-[1.75rem] border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oh-cream"
      />
    </article>
  );
}

export function TierCards({ program }: { program: PublicProgram }) {
  const t = useTranslations("rewards.tiers");
  return (
    <SnapRail label={t("rail")} className="-mx-5 scroll-px-5 pb-4 pt-1 md:mx-0 md:gap-6 md:overflow-visible md:px-0">
      {program.tiers.map((tier, i) => (
        <Card key={tier.key} program={program} tier={tier} index={i} />
      ))}
    </SnapRail>
  );
}
