"use client";

/**
 * Join a challenge, and see how far along you are (Task D9 fix round 2).
 *
 * ChallengeEnrollments loads the member's enrollments once for the whole list
 * (GET /users/:id/challenges, requireSelf). Each card's ChallengeJoin shows:
 *  - signed out: Sign in to join (the Clerk modal, back to /challenges)
 *  - signed in, not joined: Join -> POST /users/:id/challenges/:challengeId/enroll
 *    (requireSelf: the verified caller can only enroll themselves)
 *  - joined: progress ("2 of 3", "$25.00 of $100.00", or "You're in")
 *  - done: the reward, which the API granted as Oh! credit at completion
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { SignInTrigger } from "@/components/site/auth/AuthTriggers";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Spinner } from "@/components/site/order/StepSheet";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { challengeProgress, type ChallengeRequirements, type Enrollment } from "@/lib/site/challenges";
import { formatCents } from "@/lib/site/order-flow";

type Ctx = {
  ready: boolean;
  signedIn: boolean;
  enrollments: Map<string, Enrollment>;
  join: (challengeId: string) => Promise<boolean>;
};

const EnrollmentContext = createContext<Ctx | null>(null);

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const BUTTON = `inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-oh-ember-deep px-5 font-[inherit] text-[15px] font-semibold text-oh-cream disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
const QUIET = `inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-oh-stone bg-transparent px-5 font-[inherit] text-[15px] font-semibold text-oh-cream ${FOCUS}`;

export function ChallengeEnrollments({ children }: { children: ReactNode }) {
  const api = useSiteApi();
  const member = useMemberId();
  const locale = useLocale();
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!member.userId) return;
    const res = await api(`${SITE_API_URL}/users/${encodeURIComponent(member.userId)}/challenges?locale=${encodeURIComponent(locale)}`).catch(() => null);
    const rows = res?.ok ? ((await res.json().catch(() => [])) as Enrollment[]) : [];
    setEnrollments(new Map((Array.isArray(rows) ? rows : []).map((r) => [r.challengeId, r])));
    setLoaded(true);
  }, [api, member.userId, locale]);

  useEffect(() => {
    if (!member.ready) return;
    if (!member.userId) {
      setLoaded(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, member.userId]);

  const join = useCallback(
    async (challengeId: string) => {
      if (!member.userId) return false;
      const res = await api(`${SITE_API_URL}/users/${encodeURIComponent(member.userId)}/challenges/${encodeURIComponent(challengeId)}/enroll?locale=${encodeURIComponent(locale)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => null);
      // 400 "Already enrolled" (another tab): reload and show the real state.
      await load();
      return Boolean(res?.ok || res?.status === 400);
    },
    [api, member.userId, locale, load],
  );

  return <EnrollmentContext.Provider value={{ ready: member.ready && loaded, signedIn: member.signedIn, enrollments, join }}>{children}</EnrollmentContext.Provider>;
}

export function ChallengeJoin({ challengeId, name, requirements, rewardCents }: { challengeId: string; name: string; requirements: ChallengeRequirements; rewardCents: number }) {
  const t = useTranslations("challengesPage");
  const locale = useLocale();
  const ctx = useContext(EnrollmentContext);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!ctx || !ctx.ready) {
    return <span aria-hidden="true" className="mt-3 inline-block h-11 w-28 animate-pulse rounded-full bg-oh-stone motion-reduce:animate-none" />;
  }

  if (!ctx.signedIn) {
    const back = `/${locale}/challenges`;
    return (
      <SignInTrigger returnTo={back}>
        <button type="button" data-challenge-signin className={`${QUIET} mt-3 self-start`}>
          {t("signInToJoin")}
        </button>
      </SignInTrigger>
    );
  }

  const p = challengeProgress(requirements, ctx.enrollments.get(challengeId));
  const money = (c: number) => formatCents(c, locale);

  if (p.state === "open") {
    return (
      <div className="mt-3 flex flex-col items-start gap-2">
        <button
          type="button"
          data-challenge-join={challengeId}
          aria-label={t("joinNamed", { name })}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            const ok = await ctx.join(challengeId);
            setBusy(false);
            setFailed(!ok);
          }}
          className={BUTTON}
        >
          {busy ? <Spinner /> : <Icon name="plus" size={18} />}
          {busy ? t("joining") : t("join")}
        </button>
        {failed ? (
          <p role="alert" className="m-0 text-sm text-oh-ember-light">
            {t("joinFailed")}
          </p>
        ) : null}
      </div>
    );
  }

  if (p.state === "done") {
    return (
      <p data-challenge-state="done" className="m-0 mt-3 flex items-center gap-2 text-[15px] font-semibold text-oh-olive-light">
        <Icon name="check" size={18} />
        {rewardCents > 0 ? t("done", { amount: money(rewardCents) }) : t("doneNoReward")}
      </p>
    );
  }

  if (p.kind === "once") {
    return (
      <p data-challenge-state="joined" className="m-0 mt-3 flex items-center gap-2 text-[15px] text-oh-cream">
        <Icon name="check" size={18} className="text-oh-gold" />
        {t("joinedOnce")}
      </p>
    );
  }

  const label = p.kind === "money" ? t("progress", { current: money(p.current), target: money(p.target) }) : t("progress", { current: p.current, target: p.target });
  return (
    <div data-challenge-state="progress" className="mt-3 flex flex-col gap-2">
      <div role="meter" aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.current} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-oh-stone">
        <span
          className="block h-full w-[var(--challenge-done)] rounded-full bg-oh-gold transition-[width] duration-700 motion-reduce:transition-none"
          style={{ "--challenge-done": `${(p.current / p.target) * 100}%` } as React.CSSProperties}
        />
      </div>
      <p data-challenge-progress className="m-0 text-sm text-oh-cream/85">
        {label}
      </p>
    </div>
  );
}
