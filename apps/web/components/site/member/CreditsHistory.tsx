"use client";

/**
 * Task D8: /member/credits. The balance and the expiring-soon alert come
 * from the membership engine (the profile's `membership.credits` and
 * `membership.expiring` lots); the history is GET /users/:id/credits (the
 * CreditEvent log, newest first). Each event shows a translated label for
 * its type, never the stored English description or any internal note.
 */
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { CountUp } from "@/components/site/motion/CountUp";
import { SITE_API_URL, useMemberId, useSiteApi } from "@/lib/site/api";
import { ExpiringAlert } from "./CreditsCard";
import { formatDate, formatMoney } from "./format";
import { SignedOutPassport } from "./SignedOutPassport";
import { SubpageHeader } from "./SubpageHeader";
import { fetchWithRetry, toProfile, type PassportProfile } from "./usePassport";
import "./passport.css";

interface CreditEventRow {
  id: string;
  type: string;
  amountCents: number;
  createdAt: string;
}

const EVENT_TYPES = [
  "REFERRAL_SIGNUP",
  "REFERRAL_ORDER",
  "REFERRAL_ORDER_PENDING",
  "CASHBACK",
  "CREDIT_APPLIED",
  "CREDIT_EXPIRED",
  "ADMIN_ADJUSTMENT",
  "CHALLENGE_REWARD",
  "GIFT_EXCESS",
  "GOODWILL",
  "WELCOME",
  "REWARD_REDEEMED",
  "REFUND_RESTORE",
] as const;

const EVENT_ICON: Record<string, IconName> = {
  REFERRAL_SIGNUP: "gift",
  REFERRAL_ORDER: "gift",
  REFERRAL_ORDER_PENDING: "clock",
  CASHBACK: "bowl",
  CREDIT_APPLIED: "wallet",
  CREDIT_EXPIRED: "clock",
  CHALLENGE_REWARD: "seal",
  WELCOME: "gift",
  REWARD_REDEEMED: "bowl",
};

type State =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error" }
  | { status: "ready"; profile: PassportProfile; events: CreditEventRow[] };

export function CreditsHistory({ expiryDays }: { expiryDays: number }) {
  const t = useTranslations("passport.creditsPage");
  const tp = useTranslations("passport");
  const locale = useLocale();
  const api = useSiteApi();
  const { userId, ready, signedIn } = useMemberId();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) return setState({ status: "signedOut" });
    if (!userId) return setState({ status: "error" });
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const id = encodeURIComponent(userId);
        const [p, c] = await Promise.all([
          fetchWithRetry(api, `${SITE_API_URL}/users/${id}/profile`),
          fetchWithRetry(api, `${SITE_API_URL}/users/${id}/credits`),
        ]);
        if (!p.ok || !c.ok) throw new Error(`${p.status}/${c.status}`);
        const profile = toProfile(userId, await p.json());
        const body = await c.json();
        const events: CreditEventRow[] = Array.isArray(body?.events) ? body.events : [];
        if (!cancelled) setState({ status: "ready", profile, events });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, userId, attempt]);

  if (state.status === "signedOut") return <SignedOutPassport program={null} />;

  return (
    <div data-credits-page={state.status} className="px-4 pb-16 pt-4 md:px-8 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <SubpageHeader eyebrow={t("eyebrow")} title={t("title")} />

        {state.status === "loading" ? (
          <p role="status" className="m-0 mt-8 text-base text-oh-cream/70">
            {tp("loading")}
          </p>
        ) : null}
        {state.status === "error" ? (
          <div role="alert" className="mt-8">
            <p className="m-0 text-base text-oh-cream/80">{tp("error.body")}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-4 inline-flex min-h-12 cursor-pointer appearance-none items-center rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {tp("error.retry")}
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <>
            <div className="mp-cover mt-8 rounded-[1.5rem] p-5 ring-1 ring-oh-gold/30 md:p-7">
              <p className="m-0 text-sm text-oh-cream/70">{t("balance")}</p>
              <p data-credits-balance className="m-0 mt-1 font-display text-[3.25rem] leading-none tabular-nums text-oh-gold">
                <CountUp to={state.profile.creditsCents} duration={900} format={(v) => formatMoney(Math.round(v), locale)} />
              </p>
              <p className="m-0 mt-3 text-base text-oh-cream/80">{tp("credits.earn", { pct: state.profile.cashbackPct })}</p>
            </div>

            {state.profile.expiring.length > 0 ? (
              <div className="mt-4">
                <ExpiringAlert lots={state.profile.expiring} />
              </div>
            ) : null}

            <section aria-labelledby="credit-how" className="mt-10">
              <h2 id="credit-how" className="m-0 text-lg font-semibold text-oh-cream">
                {t("howTitle")}
              </h2>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                {[t("how1", { days: expiryDays }), t("how2"), t("how3")].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-base text-oh-cream/80">
                    <Icon name="check" size={18} className="mt-1 shrink-0 text-oh-gold" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="credit-history" className="mt-10">
              <h2 id="credit-history" className="m-0 text-lg font-semibold text-oh-cream">
                {t("history")}
              </h2>
              {state.events.length === 0 ? (
                <p className="m-0 mt-3 text-base text-oh-cream/70">{t("empty")}</p>
              ) : (
                <ul className="m-0 mt-3 list-none divide-y divide-oh-stone/70 border-y border-oh-stone/70 p-0">
                  {state.events.map((e) => {
                    const known = (EVENT_TYPES as readonly string[]).includes(e.type);
                    const positive = e.amountCents > 0;
                    return (
                      <li key={e.id} data-credit-event={e.type} className="flex min-h-16 items-center gap-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-ink text-oh-gold">
                          <Icon name={EVENT_ICON[e.type] ?? "wallet"} size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-base text-oh-cream">{t(`events.${known ? e.type : "OTHER"}`)}</p>
                          <p className="m-0 text-sm text-oh-cream/65">{formatDate(e.createdAt, locale)}</p>
                        </div>
                        <p className={`m-0 shrink-0 text-base font-semibold tabular-nums ${positive ? "text-oh-olive-light" : "text-oh-cream/75"}`}>
                          {`${positive ? "+" : "−"}${formatMoney(Math.abs(e.amountCents), locale)}`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
