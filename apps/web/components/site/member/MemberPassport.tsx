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
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Body, Title } from "@/components/site/Text";
import { useSiteAuth } from "@/lib/site/auth";
import type { PublicProgram } from "@/lib/site/simulate";
import type { CollectionSeal } from "./SealCollection";
import { SignedOutPassport } from "./SignedOutPassport";
import { usePassport } from "./usePassport";
import "./passport.css";

// Task G2a: the signed-in passport is its own chunk; signed-out visitors
// never download it.
const loadReady = () => import("./PassportReady");
const PassportReady = dynamic(() => loadReady().then((m) => m.PassportReady), { ssr: false, loading: () => <Loading /> });

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

export function MemberPassport({ program, seals }: { program: PublicProgram | null; seals: CollectionSeal[] }) {
  const { state, retry, postMoments, api } = usePassport();
  const { isSignedIn } = useSiteAuth();
  // Fetch the signed-in chunk alongside the profile, not after it.
  useEffect(() => {
    if (isSignedIn) void loadReady();
  }, [isSignedIn]);

  if (state.status === "signedOut") return <SignedOutPassport program={program} />;
  if (state.status === "loading") return <Loading />;
  if (state.status === "error" || !program) return <LoadError onRetry={retry} />;
  return <PassportReady profile={state.profile} program={program} seals={seals} postMoments={postMoments} api={api} />;
}
