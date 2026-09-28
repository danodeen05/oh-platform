"use client";

/**
 * The signed-in half of the member passport (Task D8), split out of
 * MemberPassport.tsx in Task G2a so a signed-out visitor never downloads it:
 * the cover, the climb, the wallet, credit, seals, Wallet passes and the
 * welcome and tier-up moments. MemberPassport loads it with next/dynamic
 * (and starts the download as soon as the visitor is known to be signed in,
 * alongside the profile request).
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { useReducedMotion } from "@/components/site/motion/useReducedMotion";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { setUserProperties } from "@/lib/analytics";
import { localizedHref } from "@/lib/site/nav";
import type { PublicProgram } from "@/lib/site/simulate";
import { CreditsCard } from "./CreditsCard";
import { momentsFor } from "./moments";
import { Passport } from "./Passport";
import { ProgressArcs } from "./ProgressArcs";
import { RewardsWallet } from "./RewardsWallet";
import { SealCollection, type CollectionSeal } from "./SealCollection";
import { TierUpMoment } from "./TierUpMoment";
import type { usePassport, PassportProfile } from "./usePassport";
import { WalletButtons } from "./WalletButtons";
import { WelcomeSheet } from "./WelcomeSheet";

function MoreLinks() {
  const t = useTranslations("passport.links");
  const locale = useLocale();
  const links: Array<{ href: string; label: string; icon: IconName }> = [
    { href: "/member/orders", label: t("orders"), icon: "bowl" },
    { href: "/member/credits", label: t("credits"), icon: "wallet" },
    { href: "/referral", label: t("referral"), icon: "gift" },
    { href: "/rewards", label: t("rewards"), icon: "seal" },
  ];
  return (
    <nav aria-label={t("label")} className="px-4 pb-16 md:px-8">
      <ul className="mx-auto m-0 grid max-w-6xl list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 md:grid-cols-4">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={localizedHref(locale, l.href)}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-oh-stone/80 bg-oh-ink px-4 text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-ash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              <Icon name={l.icon} size={22} className="shrink-0 text-oh-gold" />
              <span className="min-w-0 flex-1">{l.label}</span>
              <Icon name="chevron" size={18} className="shrink-0 text-oh-cream/50" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PassportReady({
  profile,
  program,
  seals,
  postMoments,
  api,
}: {
  profile: PassportProfile;
  program: PublicProgram;
  seals: CollectionSeal[];
  postMoments: ReturnType<typeof usePassport>["postMoments"];
  api: ReturnType<typeof usePassport>["api"];
}) {
  const t = useTranslations("passport");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const order = useMemo(() => program.tiers.map((x) => x.key), [program]);
  const initial = useMemo(() => momentsFor({ ...profile.flags, tier: profile.tier }, order), [profile, order]);
  const [welcomeOpen, setWelcomeOpen] = useState(initial.welcome);
  const [tierUp, setTierUp] = useState<string | null>(initial.tierUp);
  const silentSent = useRef(false);

  useEffect(() => {
    setUserProperties({
      membershipTier: profile.tier,
      lifetimeOrderCount: profile.lifetimeOrderCount,
    });
  }, [profile.tier, profile.lifetimeOrderCount]);

  useEffect(() => {
    if (initial.recordSilently && !silentSent.current) {
      silentSent.current = true;
      void postMoments({ tierCelebrated: initial.recordSilently });
    }
  }, [initial.recordSilently, postMoments]);

  const finishWelcome = useCallback(() => {
    setWelcomeOpen(false);
    // The tier the member holds today is part of the welcome, never a "tier-up".
    void postMoments({ welcomeSeen: true, tierCelebrated: profile.tier });
  }, [postMoments, profile.tier]);

  const closeTierUp = useCallback(() => {
    const tier = tierUp;
    setTierUp(null);
    if (tier) void postMoments({ tierCelebrated: tier });
  }, [postMoments, tierUp]);

  const freeBowls = profile.rewards.filter((r) => r.type === "FREE_BOWL" && new Date(r.windowEndsAt).getTime() > Date.now());
  const upgradeBowl = tierUp ? (freeBowls.find((r) => r.issuedFor === `upgrade:${tierUp}`) ?? freeBowls[0] ?? null) : null;

  return (
    <div data-passport-state="ready" data-reduced={reduced ? "true" : "false"}>
      <Passport profile={profile} hasFreeBowl={freeBowls.length > 0} />
      <ProgressArcs profile={profile} program={program} />
      <div className="bg-oh-ink/40">
        <RewardsWallet profile={profile} />
      </div>
      <CreditsCard creditsCents={profile.creditsCents} cashbackPct={profile.cashbackPct} expiring={profile.expiring} expiryDays={program.creditExpiryDays} />
      <div className="bg-oh-ink/40">
        <SealCollection seals={seals} earned={profile.earnedSlugs} userId={profile.userId} />
      </div>
      <section aria-labelledby="wallet-title" className="px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 md:items-center md:gap-12">
          <div>
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("wallet.eyebrow")}
            </Eyebrow>
            <Title id="wallet-title" locale={locale} className="m-0 mt-3 text-oh-cream">
              {t("wallet.title")}
            </Title>
            <Body locale={locale} className="m-0 mt-3 text-oh-cream/75">
              {t("wallet.body")}
            </Body>
          </div>
          <WalletButtons api={api} userId={profile.userId} />
        </div>
      </section>
      <MoreLinks />

      <WelcomeSheet open={welcomeOpen} onDone={finishWelcome} profile={profile} program={program} api={api} />
      {tierUp && !welcomeOpen ? (
        <TierUpMoment
          tier={tierUp}
          cashbackPct={program.tiers.find((x) => x.key === tierUp)?.cashbackPct ?? null}
          freeBowl={upgradeBowl}
          onClose={closeTierUp}
        />
      ) : null}
    </div>
  );
}
