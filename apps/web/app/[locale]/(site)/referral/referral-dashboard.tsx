"use client";

/**
 * The member's side of /referral (Task D9): their link (share sheet, copy,
 * QR), the 30-day cap meter, and what referrals have earned. All from
 * GET /users/:id/credits (requireSelf): `referralCode`, `balance` and
 * `referral` (packages/api/src/membership/referral-summary.js: REFERRAL
 * CreditLots and the cap count).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { CountUp } from "@/components/site/motion/CountUp";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { copyText, referralLink, shareOrCopy, type ShareOutcome } from "@/lib/site/referral";
import { formatMoney, type ReferralProgram } from "@/lib/site/program";
import { event } from "@/lib/analytics";

const ReferralQrSheet = dynamic(() => import("./ReferralQrSheet"), { ssr: false });

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PRIMARY = `inline-flex min-h-14 w-full cursor-pointer font-[inherit] items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 flex-1 cursor-pointer font-[inherit] items-center justify-center gap-2 rounded-full border border-oh-stone bg-transparent px-4 text-[15px] font-semibold text-oh-cream ${FOCUS}`;

type Lot = { id: string; amountCents: number; remainingCents: number; createdAt: string; expiresAt: string };
type Summary = {
  earnedCents: number;
  paidCount: number;
  paidLast30Days: number;
  remainingThis30Days: number;
  maxPaidPer30Days: number;
  friendsJoined: number;
  recent: Lot[];
};
type Credits = { balance: number; referralCode: string; referral?: Summary };

export default function ReferralDashboard({ program }: { program: ReferralProgram }) {
  const t = useTranslations("referralPage");
  const locale = useLocale();
  const api = useSiteApi();
  const member = useMemberId();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ShareOutcome | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const linkRef = useRef<HTMLInputElement | null>(null);

  const friend = formatMoney(program.refereeCents, locale);
  const you = formatMoney(program.referrerCents, locale);
  const money = useCallback((c: number) => formatMoney(c, locale), [locale]);

  useEffect(() => {
    if (!member.ready) return;
    if (!member.userId) {
      setState(member.signedIn ? "error" : "ready");
      return;
    }
    let cancelled = false;
    setState("loading");
    (async () => {
      const res = await api(`${SITE_API_URL}/users/${encodeURIComponent(member.userId!)}/credits`).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as Credits | null) : null;
      if (cancelled) return;
      if (body?.referralCode) {
        setCredits(body);
        setState("ready");
      } else setState("error");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, member.userId, attempt]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = credits ? referralLink(origin, credits.referralCode) : "";

  async function onShare() {
    if (!credits) return;
    const outcome = await shareOrCopy(typeof navigator !== "undefined" ? navigator : null, { title: t("shareTitle"), text: t("shareText", { friend }), url: link });
    setStatus(outcome === "cancelled" ? null : outcome);
    if (outcome === "failed") linkRef.current?.select();
    if (outcome === "shared" || outcome === "copied") event({ action: outcome === "shared" ? "share_referral_link" : "copy_referral_link", category: "engagement", label: "referral" });
  }

  async function onCopy() {
    const outcome = await copyText(typeof navigator !== "undefined" ? navigator : null, link);
    setStatus(outcome);
    if (outcome === "failed") linkRef.current?.select();
    if (outcome === "copied") event({ action: "copy_referral_link", category: "engagement", label: "referral" });
  }

  // ------------------------------------------------------------ signed out
  if (member.ready && !member.signedIn) {
    const back = `/${locale}/referral`;
    return (
      <section data-referral-signin aria-labelledby="referral-signin" className="flex flex-col gap-5 rounded-3xl bg-oh-ink p-5 md:p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-oh-stone text-oh-cream">
          <Icon name="user" size={24} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="referral-signin" className="m-0 text-xl font-semibold text-oh-cream">
            {t("signedOutTitle")}
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{t("signedOutBody")}</p>
        </div>
        <SignInButton mode="modal" forceRedirectUrl={back} signUpForceRedirectUrl={back}>
          <button type="button" data-referral-signin-button className={PRIMARY}>
            {t("signIn")}
          </button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl={back} signInForceRedirectUrl={back}>
          <button type="button" className={`min-h-11 cursor-pointer appearance-none border-0 bg-transparent p-0 font-[inherit] text-[15px] text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 ${FOCUS}`}>
            {t("create")}
          </button>
        </SignUpButton>
      </section>
    );
  }

  // ------------------------------------------------------------ loading / error
  if (state !== "ready" || !credits) {
    return (
      <section aria-busy={state === "loading"} className="flex flex-col gap-4 rounded-3xl bg-oh-ink p-5 md:p-6">
        {state === "error" ? (
          <div role="alert" data-referral-error className="flex flex-col items-start gap-3">
            <p className="m-0 text-lg font-semibold text-oh-cream">{t("error")}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`inline-flex min-h-11 cursor-pointer font-[inherit] items-center rounded-full border border-oh-stone bg-transparent px-5 text-[15px] font-semibold text-oh-cream ${FOCUS}`}>
              {t("retry")}
            </button>
          </div>
        ) : (
          <>
            <span className="sr-only" role="status">
              {t("loading")}
            </span>
            <span aria-hidden="true" className="h-4 w-24 animate-pulse rounded bg-oh-stone motion-reduce:animate-none" />
            <span aria-hidden="true" className="h-12 w-full animate-pulse rounded-2xl bg-oh-stone motion-reduce:animate-none" />
            <span aria-hidden="true" className="h-14 w-full animate-pulse rounded-full bg-oh-stone motion-reduce:animate-none" />
          </>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------ the member's link
  const s = credits.referral;
  const max = s?.maxPaidPer30Days ?? program.maxPaidPer30Days;
  const left = s?.remainingThis30Days ?? max;
  const used = Math.min(max, max - left);

  return (
    <div data-referral-dashboard className="flex flex-col gap-5">
      <section aria-labelledby="referral-link" className="flex flex-col gap-4 rounded-3xl bg-oh-ink p-5 md:p-6">
        <label id="referral-link" htmlFor="referral-link-input" className="text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
          {t("linkLabel")}
        </label>
        <input
          id="referral-link-input"
          ref={linkRef}
          data-referral-link
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-12 w-full min-w-0 truncate rounded-2xl border border-oh-stone bg-oh-charcoal px-4 font-mono text-base text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        />
        <button type="button" data-referral-share onClick={onShare} className={PRIMARY}>
          <Icon name="share" size={20} />
          {t("share")}
        </button>
        <div className="flex flex-wrap gap-3">
          <button type="button" data-referral-copy onClick={onCopy} className={SECONDARY}>
            <Icon name="check" size={18} />
            {t("copy")}
          </button>
          <button
            type="button"
            data-referral-qr
            onClick={() => {
              setQrOpen(true);
              event({ action: "show_referral_qr", category: "engagement", label: "referral" });
            }}
            className={SECONDARY}
          >
            <Icon name="qr" size={18} />
            {t("qr")}
          </button>
        </div>
        <p data-referral-status role="status" aria-live="polite" className="m-0 min-h-6 text-[15px] text-oh-cream/85">
          {status === "copied" ? t("copied") : status === "failed" ? t("copyFailed") : ""}
        </p>

        {/* The cap, from the program */}
        <div data-referral-cap className="flex flex-col gap-2 border-t border-oh-stone pt-4">
          <p className="m-0 text-[15px] font-semibold text-oh-cream">{t("cap", { max })}</p>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={used}
            aria-label={t("capLeft", { left, max })}
            className="h-2 w-full overflow-hidden rounded-full bg-oh-stone"
          >
            <span
              className="block h-full w-[var(--cap-used)] rounded-full bg-oh-gold transition-[width] duration-700 motion-reduce:transition-none"
              style={{ "--cap-used": `${max ? (used / max) * 100 : 0}%` } as React.CSSProperties}
            />
          </div>
          <p className="m-0 text-sm text-oh-mute">{left > 0 ? t("capLeft", { left, max }) : t("capReached", { max, friend })}</p>
        </div>
      </section>

      <section aria-labelledby="referral-stats" className="rounded-3xl bg-oh-linen p-5 text-oh-charcoal md:p-6">
        <h2 id="referral-stats" className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-charcoal/80">
          {t("statsTitle")}
        </h2>
        <dl className="m-0 mt-4 grid grid-cols-3 gap-3">
          <Stat label={t("earned")} data="earned">
            <CountUp to={(s?.earnedCents ?? 0) / 100} decimals={(s?.earnedCents ?? 0) % 100 ? 2 : 0} prefix="$" />
          </Stat>
          <Stat label={t("joined")} data="joined">
            <CountUp to={s?.friendsJoined ?? 0} />
          </Stat>
          <Stat label={t("paid")} data="paid">
            <CountUp to={s?.paidCount ?? 0} />
          </Stat>
        </dl>
        <p className="m-0 mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-oh-charcoal/15 pt-4 text-[15px]">
          <span>{t("balance")}</span>
          <span data-referral-balance className="font-semibold">
            {money(credits.balance || 0)} <span className="font-normal text-oh-charcoal/75">{t("balanceNote")}</span>
          </span>
        </p>
      </section>

      <section aria-labelledby="referral-history" className="rounded-3xl border border-oh-stone p-5 md:p-6">
        <h2 id="referral-history" className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
          {t("historyTitle")}
        </h2>
        {s && s.recent.length ? (
          <ul data-referral-history className="m-0 mt-3 flex list-none flex-col p-0">
            {s.recent.map((lot) => (
              <li key={lot.id} className="flex items-center justify-between gap-3 border-b border-oh-stone py-3 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] text-oh-cream">{t("historyItem")}</span>
                  <span className="text-sm text-oh-mute">
                    {t("historyAdded", { date: shortDate(lot.createdAt, locale) })}
                    {" · "}
                    {lot.remainingCents <= 0
                      ? t("historyUsed")
                      : new Date(lot.expiresAt).getTime() < Date.now()
                        ? t("historyExpired")
                        : t("historyExpires", { date: shortDate(lot.expiresAt, locale) })}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold text-oh-gold">+{money(lot.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-referral-history-empty className="m-0 mt-3 text-[15px] leading-relaxed text-oh-mute">
            {t("historyEmpty", { you })}
          </p>
        )}
      </section>

      {qrOpen ? <ReferralQrSheet open={qrOpen} onClose={() => setQrOpen(false)} link={link} friend={friend} /> : null}
    </div>
  );
}

function Stat({ label, data, children }: { label: string; data: string; children: React.ReactNode }) {
  return (
    <div data-referral-stat={data} className="flex min-w-0 flex-col gap-1">
      <dt className="order-2 text-sm leading-snug text-oh-charcoal/80 [overflow-wrap:anywhere]">{label}</dt>
      <dd className="order-1 m-0 font-display text-4xl leading-none">{children}</dd>
    </div>
  );
}

function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "America/Denver" });
}
