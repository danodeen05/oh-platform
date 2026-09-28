"use client";

/**
 * Task D8: the member passport (/member). Owner rule 4: member benefits get
 * the most love, so this reads as a passport, not a dashboard: the cover
 * (tier, name, number, stamps), the climb (two arcs and what the next tier
 * brings), the rewards wallet, credit, the seal collection and Wallet.
 *
 * Data: usePassport (GET /users/:id/profile through the Clerk fetch). The
 * program and the localized seal catalog come from the server page.
 *
 * Moments (moments.ts): the welcome sheet first; the tier-up moment when
 * the tier is above the last celebrated one. Each is recorded with
 * POST /users/:id/moments when it closes, and hidden locally at once so a
 * slow or failed write never shows it twice in one visit.
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
import { SignedOutPassport } from "./SignedOutPassport";
import { TierUpMoment } from "./TierUpMoment";
import { usePassport, type PassportProfile } from "./usePassport";
import { WalletButtons } from "./WalletButtons";
import { WelcomeSheet } from "./WelcomeSheet";
import "./passport.css";

function Loading() {
  const t = useTranslations("passport");
  return (
    <div data-passport-state="loading" className="px-4 pt-4 md:px-8 md:pt-10">
      <div className="mx-auto max-w-6xl">
        <div aria-hidden="true" className="mp-cover h-80 animate-pulse rounded-[1.75rem] ring-1 ring-oh-gold/20 motion-reduce:animate-none md:w-[55%]" />
        <p role="status" className="m-0 mt-4 text-base text-oh-cream/70">
          {t("loading")}
        </p>
      </div>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("passport.error");
  const locale = useLocale();
  return (
    <div data-passport-state="error" role="alert" className="mx-auto max-w-xl px-4 py-20 md:px-8">
      <Title locale={locale} className="m-0 text-oh-cream">
        {t("title")}
      </Title>
      <Body locale={locale} className="m-0 mt-3 text-oh-cream/75">
        {t("body")}
      </Body>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-12 cursor-pointer appearance-none items-center rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
      >
        {t("retry")}
      </button>
    </div>
  );
}

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

function Ready({
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

export function MemberPassport({ program, seals }: { program: PublicProgram | null; seals: CollectionSeal[] }) {
  const { state, retry, postMoments, api } = usePassport();

  if (state.status === "signedOut") return <SignedOutPassport program={program} />;
  if (state.status === "loading") return <Loading />;
  if (state.status === "error" || !program) return <LoadError onRetry={retry} />;
  return <Ready profile={state.profile} program={program} seals={seals} postMoments={postMoments} api={api} />;
}
