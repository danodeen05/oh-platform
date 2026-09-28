"use client";

/**
 * The member's standing at a glance (Task E2), from get_my_profile: the tier
 * mark, spendable store credit, what expires soon, and the way to the next
 * tier. Every number is the server's.
 */
import { useTranslations } from "next-intl";
import { TierMark, type Tier } from "@/components/site/tiers/TierMark";
import { CardFrame, Eyebrow, money, useCardContext } from "./CardKit";
import type { RewardCardData } from "./types";

const TIER_MARK: Record<string, Tier> = { CHOPSTICK: "chopstick", NOODLE_MASTER: "noodle-master", BEEF_BOSS: "beef-boss" };
const KNOWN = new Set(Object.keys(TIER_MARK));

export function RewardCard({ card }: { card: RewardCardData }) {
  const t = useTranslations("chappyWeb.cards.reward");
  const { locale, cjk } = useCardContext();
  const tier = KNOWN.has(card.tier) ? card.tier : "CHOPSTICK";
  const next = card.next && KNOWN.has(card.next) ? card.next : null;
  const bars = [card.orders ? { key: "orders", ...card.orders } : null, card.referrals && card.referrals.need > 0 ? { key: "referrals", ...card.referrals } : null].filter(
    (b): b is { key: "orders" | "referrals"; have: number; need: number } => b !== null,
  );

  return (
    <CardFrame type="reward" label={t("label")}>
      <div className="flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-oh-charcoal">
          <TierMark tier={TIER_MARK[tier]} tone="gold" size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow>{t(`tiers.${tier}`)}</Eyebrow>
          <p className="m-0 mt-0.5 text-sm text-oh-cream/75">{t("cashback", { pct: card.cashbackPct })}</p>
        </div>
      </div>
      <div className="grid gap-3 border-0 border-t border-solid border-oh-stone/70 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="m-0 text-sm text-oh-cream/75">{t("credit")}</p>
          <p className={`${cjk ? "font-display-cjk" : "font-display"} m-0 text-3xl tabular-nums text-oh-cream`}>{money(card.creditCents, locale)}</p>
        </div>
        {card.expiringCents > 0 ? <p className="m-0 text-sm text-oh-gold">{t("expiring", { amount: money(card.expiringCents, locale) })}</p> : null}
        {card.rewards > 0 ? <p className="m-0 text-sm text-oh-cream/75">{t("rewards", { count: card.rewards })}</p> : null}
        {next ? (
          <div className="grid gap-2">
            <p className="m-0 text-sm font-semibold text-oh-cream">{t("toNext", { tier: t(`tiers.${next}`) })}</p>
            {bars.map((b) => (
              <div key={b.key}>
                <p className="m-0 text-xs tabular-nums text-oh-mute">{t(b.key, { have: Math.min(b.have, b.need), need: b.need })}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-oh-stone">
                  <div className="h-full rounded-full bg-oh-gold" style={{ width: `${b.need > 0 ? Math.min(100, (b.have / b.need) * 100) : 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-oh-cream/75">{t("top")}</p>
        )}
      </div>
    </CardFrame>
  );
}
