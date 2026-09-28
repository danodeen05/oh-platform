"use client";

/**
 * Task D7: the hero's live line. Signed in: your tier and your progress to
 * the next one, as two gold meters. Signed out: a sign-in prompt (Clerk's
 * modal). The page below is fully useful either way.
 */
import { SignInTrigger } from "@/components/site/auth/AuthTriggers";
import { useTranslations } from "next-intl";
import { TierMark } from "@/components/site/tiers/TierMark";
import { tierMeta } from "@/lib/site/tier-meta";
import { useRewardsMember } from "./RewardsMember";

function Meter({ label, have, need }: { label: string; have: number; need: number }) {
  const pct = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 100;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm text-oh-cream/80">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-oh-cream">
          {have}/{need}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={Math.min(have, need)}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-oh-stone"
      >
        <div className="h-full rounded-full bg-oh-gold [width:var(--w)]" style={{ ["--w" as string]: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MemberStatus() {
  const t = useTranslations("rewards.member");
  const tiers = useTranslations("loyalty.tiers");
  const member = useRewardsMember();
  const name = (key: string) => tiers(`${tierMeta(key).msg}.name`);

  if (member.status === "loading") {
    return (
      <p data-member-status="loading" className="m-0 min-h-11 text-base text-oh-cream/60" aria-live="polite">
        {t("loading")}
      </p>
    );
  }

  // A signed-in member whose profile didn't load: the page still works; say nothing.
  if (member.status === "error") return null;

  if (member.status === "signedOut") {
    return (
      <div data-member-status="signedOut" className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 text-base text-oh-cream/80">{t("signedOut")}</p>
        <SignInTrigger>
          <button
            type="button"
            className="inline-flex min-h-11 cursor-pointer appearance-none items-center rounded-full border border-oh-cream/40 bg-transparent px-5 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("signIn")}
          </button>
        </SignInTrigger>
      </div>
    );
  }

  const progress = member.progress;
  const meta = tierMeta(member.tier);
  return (
    <div
      data-member-status="ready"
      className="flex items-start gap-4 rounded-2xl border border-oh-stone/70 bg-oh-ink/80 p-4 backdrop-blur-sm"
    >
      <span className="mt-0.5 shrink-0 text-oh-gold">
        <TierMark tier={meta.mark} tone="current" size={44} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-base font-semibold text-oh-cream">{t("youAre", { tier: name(member.tier) })}</p>
        {progress?.next ? (
          <>
            <p className="m-0 mt-1 text-sm text-oh-cream/75">
              {t("toNext", {
                orders: progress.orders.have,
                ordersNeed: progress.orders.need,
                referrals: progress.referrals.have,
                referralsNeed: progress.referrals.need,
                next: name(progress.next),
              })}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-6">
              <Meter label={t("ordersLabel", { next: name(progress.next) })} have={progress.orders.have} need={progress.orders.need} />
              <Meter
                label={t("referralsLabel", { next: name(progress.next) })}
                have={progress.referrals.have}
                need={progress.referrals.need}
              />
            </div>
          </>
        ) : (
          <p className="m-0 mt-1 text-sm text-oh-cream/75">{t("top", { pct: member.cashbackPct ?? 0 })}</p>
        )}
      </div>
    </div>
  );
}
