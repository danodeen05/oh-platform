"use client";

/**
 * Task D7: the climb. The three tier marks on a vertical path that fills
 * with gold as it scrolls through the viewport (rewards.css drives --climb
 * and each stop's --lit natively; useScrollVars is the fallback). Each stop
 * says what unlocks it, straight from the program. A signed-in member sees
 * "You are here" on their own tier.
 */
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Eyebrow } from "@/components/site/Text";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { TierMark } from "@/components/site/tiers/TierMark";
import type { PublicProgram } from "@/lib/site/program";
import { tierMeta } from "@/lib/site/tier-meta";
import { useRewardsMember } from "./RewardsMember";
import { clamp01, coverProgress, useScrollVars } from "./useScrollVars";
import "./rewards.css";

function measureClimb(el: HTMLElement, viewport: number) {
  el.style.setProperty("--climb", coverProgress(el.getBoundingClientRect(), viewport, 0.2, 0.7).toFixed(3));
  el.querySelectorAll<HTMLElement>(".rw-stop").forEach((stop) => {
    const r = stop.getBoundingClientRect();
    stop.style.setProperty("--lit", clamp01((viewport * 0.62 - r.top) / (r.height || 1)).toFixed(3));
  });
}

export function Climb({ program }: { program: PublicProgram }) {
  const t = useTranslations("rewards.climb");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const reduced = useReducedMotion();
  const member = useRewardsMember();
  const ref = useRef<HTMLOListElement | null>(null);
  useScrollVars(ref, measureClimb, !reduced);

  const name = (key: string) => tiers(`${tierMeta(key).msg}.name`);
  const total = program.tiers.length;
  const current = member.status === "ready" ? member.tier : null;

  return (
    <ol
      ref={ref}
      data-climb
      data-static={reduced ? "true" : "false"}
      className="rw-climb relative m-0 list-none p-0"
    >
      {/* The path: a hairline, and the gold that fills it. */}
      <span aria-hidden="true" className="absolute bottom-10 left-[39px] top-10 w-0.5 rounded-full bg-oh-stone md:left-[55px]" />
      <span
        aria-hidden="true"
        className="rw-climb-fill absolute bottom-10 left-[39px] top-10 w-0.5 rounded-full bg-oh-gold md:left-[55px]"
      />
      {program.tiers.map((tier, i) => {
        const meta = tierMeta(tier.key);
        const prev = i > 0 ? program.tiers[i - 1] : null;
        const isHere = current === tier.key;
        return (
          <li key={tier.key} data-climb-stop={tier.key} className="rw-stop relative flex gap-5 pb-14 last:pb-0 md:gap-8 md:pb-20">
            <span className="rw-stop-mark relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 bg-oh-charcoal md:h-28 md:w-28">
              <TierMark tier={meta.mark} tone="current" size={i === total - 1 ? 52 : 46} className="md:scale-125" />
            </span>
            <div className="min-w-0 flex-1 pt-2 md:pt-5">
              <Eyebrow locale={locale} className="text-oh-mute">
                {t("step", { step: i + 1, total })}
              </Eyebrow>
              <h3
                className={`${cjk ? "font-display-cjk" : "font-display"} m-0 mt-1.5 text-[1.75rem] font-normal leading-tight text-oh-cream md:text-4xl`}
              >
                {name(tier.key)}
              </h3>
              {prev?.need ? (
                <>
                  <p className="m-0 mt-2 text-lg font-semibold text-oh-gold">
                    {t("need", { orders: prev.need.orders, referrals: prev.need.referrals })}
                  </p>
                  <p className="m-0 mt-1 text-base text-oh-cream/70">{t("after", { tier: name(prev.key) })}</p>
                </>
              ) : (
                <p className="m-0 mt-2 text-base text-oh-cream/80">{t("start")}</p>
              )}
              <p className="m-0 mt-2 text-base text-oh-cream/70">{t("cashback", { pct: tier.cashbackPct })}</p>
              {isHere ? (
                <span
                  data-climb-here
                  className="mt-3 inline-flex min-h-8 items-center rounded-full bg-oh-ember-deep px-3 text-sm font-semibold text-oh-cream"
                >
                  {t("here")}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
