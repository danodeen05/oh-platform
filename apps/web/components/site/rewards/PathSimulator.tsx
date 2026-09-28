"use client";

/**
 * Task D7: the path-to-Beef-Boss simulator. Three sliders (bowls a month,
 * friends a month, average order) drive lib/site/simulate.ts against the
 * live program, and the page draws the result: the month you reach each
 * tier, a month-by-month timeline, and what you'd earn on the way (free
 * bowls, cashback, friend credits) with CountUp.
 *
 * Friends at 0 (or bowls at 0) is the "never" state: every tier needs both,
 * so the climb can't start. The sliders are native range inputs (keyboard
 * and screen reader for free) with 44px thumbs and translated
 * aria-valuetext; the results summary is a polite live region.
 */
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CountUp } from "@/components/site/motion/CountUp";
import { TierMark } from "@/components/site/tiers/TierMark";
import { tierMeta, type PublicProgram } from "@/lib/site/program";
import { simulate } from "@/lib/site/simulate";
import { formatMoney } from "./format";
import "./rewards.css";

export const SIM_MONTHS = 24;
const DEFAULTS = { bowls: 4, friends: 1, ticket: 1799 };
const TICKET = { min: 999, max: 3999, step: 50 };
const BOWLS = { min: 0, max: 20 };

interface SliderProps {
  id: string;
  kind: "bowls" | "friends" | "ticket";
  label: string;
  display: string;
  valuetext: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onChange: (n: number) => void;
}

function Slider({ id, kind, label, display, valuetext, value, min, max, step = 1, hint, onChange }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-base text-oh-cream/80">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 text-lg font-semibold tabular-nums text-oh-cream">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        data-sim-input={kind}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valuetext}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rw-range mt-1 block"
        style={{ ["--fill" as string]: `${fill}%` } as CSSProperties}
      />
      {hint ? <p className="m-0 text-sm text-oh-cream/60">{hint}</p> : null}
    </div>
  );
}

export function PathSimulator({ program }: { program: PublicProgram }) {
  const t = useTranslations("rewards.simulator");
  const tiers = useTranslations("loyalty.tiers");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  // Fixed ids (one simulator per page): useId would follow any SSR/client tree drift above it.
  const uid = "rw-sim";
  const [ready, setReady] = useState(false);
  const [bowls, setBowls] = useState(DEFAULTS.bowls);
  const cap = program.referral.maxPaidPer30Days;
  const [friends, setFriends] = useState(Math.min(DEFAULTS.friends, cap));
  const [ticket, setTicket] = useState(DEFAULTS.ticket);
  useEffect(() => setReady(true), []);

  const result = useMemo(
    () => simulate(program, { bowlsPerMonth: bowls, friendsPerMonth: friends, avgTicketCents: ticket, months: SIM_MONTHS }),
    [program, bowls, friends, ticket],
  );

  const name = (key: string) => tiers(`${tierMeta(key).msg}.name`);
  const first = program.tiers[0];
  const top = program.tiers[program.tiers.length - 1];
  const never = bowls === 0 || friends === 0;
  const friendCreditCents = friends * program.referral.referrerCents * SIM_MONTHS;
  const tierIndex = (key: string) => Math.max(0, program.tiers.findIndex((x) => x.key === key));
  const [nextDate, topDate] = [result.tierDates[0], result.tierDates[result.tierDates.length - 1]];

  let summary: string;
  if (!nextDate?.month) summary = t("summaryNone", { tier: name(first.key), months: SIM_MONTHS });
  else if (!topDate?.month)
    summary = t("summaryPartial", { first: name(nextDate.tier), firstMonth: nextDate.month, last: name(topDate.tier), months: SIM_MONTHS });
  else summary = t("summary", { first: name(nextDate.tier), firstMonth: nextDate.month, last: name(topDate.tier), lastMonth: topDate.month });

  const serif = cjk ? "font-display-cjk" : "font-display";

  return (
    <div
      data-simulator
      data-ready={ready ? "true" : "false"}
      className="grid gap-6 rounded-[2rem] border border-oh-stone/70 bg-oh-ink p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 md:p-10"
    >
      {/* Controls */}
      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-4 p-0 text-xs font-semibold uppercase tracking-[0.2em] text-oh-mute">{t("controls")}</legend>
        <Slider
          id={`${uid}-bowls`}
          kind="bowls"
          label={t("bowls.label")}
          display={String(bowls)}
          valuetext={t("bowls.value", { count: bowls })}
          value={bowls}
          min={BOWLS.min}
          max={BOWLS.max}
          onChange={setBowls}
        />
        <Slider
          id={`${uid}-friends`}
          kind="friends"
          label={t("friends.label")}
          display={String(friends)}
          valuetext={t("friends.value", { count: friends })}
          value={friends}
          min={0}
          max={cap}
          hint={t("friends.cap", { cap })}
          onChange={setFriends}
        />
        <Slider
          id={`${uid}-ticket`}
          kind="ticket"
          label={t("ticket.label")}
          display={formatMoney(ticket, locale)}
          valuetext={t("ticket.value", { amount: formatMoney(ticket, locale) })}
          value={ticket}
          min={TICKET.min}
          max={TICKET.max}
          step={TICKET.step}
          onChange={setTicket}
        />
      </fieldset>

      {/* Results */}
      <div className="min-w-0" aria-label={t("results")} role="group">
        <p className="sr-only" aria-live="polite" data-sim-summary>
          {summary}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {result.tierDates.map((d) => {
            const month = d.month;
            const state = month ? String(month) : never ? "never" : "beyond";
            const isTop = d.tier === top.key;
            return (
              <div
                key={d.tier}
                data-tier-date={d.tier}
                data-month={state}
                className={`min-w-0 rounded-2xl border p-4 transition-colors ${
                  month ? (isTop ? "border-oh-gold/60 bg-oh-gold/10" : "border-oh-cream/25 bg-oh-cream/5") : "border-oh-stone bg-transparent"
                }`}
              >
                <span className={month ? (isTop ? "text-oh-gold" : "text-oh-cream") : "text-oh-ash"}>
                  <TierMark tier={tierMeta(d.tier).mark} tone="current" size={32} />
                </span>
                <p className="m-0 mt-2 text-sm leading-snug text-oh-cream/75 [overflow-wrap:anywhere] hyphens-auto">{name(d.tier)}</p>
                <p className={`${serif} m-0 mt-0.5 leading-tight ${month ? "text-2xl text-oh-cream" : "text-lg text-oh-mute"}`}>
                  {month ? t("reach", { month }) : t("beyond", { months: SIM_MONTHS })}
                </p>
              </div>
            );
          })}
        </div>

        {never ? (
          <div data-sim-never className="mt-4 rounded-2xl border border-oh-ember/50 bg-oh-ember-deep/15 p-4">
            <p data-sim-never-title className={`${serif} m-0 text-2xl leading-tight text-oh-cream`}>
              {t("never.title")}
            </p>
            <p className="m-0 mt-1.5 text-base text-oh-cream/80">{t("never.body", { tier: name(top.key) })}</p>
          </div>
        ) : null}

        {/* Month-by-month: bar height and color follow the tier held that month. */}
        <figure className="m-0 mt-6">
          <figcaption className="text-sm text-oh-cream/70">{t("timeline", { months: SIM_MONTHS })}</figcaption>
          <div aria-hidden="true" className="mt-3 flex h-24 items-end gap-[3px]">
            {result.timeline.map((m, i) => {
              const level = tierIndex(m.tier);
              const upgraded = i > 0 && result.timeline[i - 1].tier !== m.tier;
              const height = `${30 + (level / Math.max(1, program.tiers.length - 1)) * 70}%`;
              const color = level === program.tiers.length - 1 ? "bg-oh-gold" : level > 0 ? "bg-oh-cream/70" : "bg-oh-ash/50";
              return (
                <span key={m.month} className="relative flex h-full min-w-0 flex-1 items-end">
                  <span className={`rw-bar block w-full rounded-t-sm ${color} [height:var(--h)]`} style={{ ["--h" as string]: height } as CSSProperties} />
                  {upgraded || (i === 0 && m.tier !== first.key) ? (
                    <span className="absolute -top-2.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-oh-ember-light" />
                  ) : null}
                </span>
              );
            })}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex justify-between text-xs tabular-nums text-oh-cream/60">
            <span>1</span>
            <span>{t("month")}</span>
            <span>{SIM_MONTHS}</span>
          </div>
        </figure>

        {/* What you'd earn on the way. */}
        <dl className="m-0 mt-6 grid grid-cols-3 gap-3 border-t border-oh-stone pt-5">
          <div className="min-w-0">
            <dt className="text-sm leading-snug text-oh-cream/70 hyphens-auto">{t("totals.freeBowls")}</dt>
            <dd data-sim-free-bowls data-value={result.freeBowls} className={`${serif} m-0 mt-1 text-[1.75rem] leading-tight md:text-4xl text-oh-cream`}>
              <CountUp to={result.freeBowls} duration={600} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm leading-snug text-oh-cream/70 hyphens-auto">{t("totals.cashback")}</dt>
            <dd data-sim-cashback data-value={result.cashbackCents} className={`${serif} m-0 mt-1 text-[1.75rem] leading-tight md:text-4xl text-oh-gold`}>
              <CountUp to={Math.floor(result.cashbackCents / 100)} prefix="$" duration={700} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm leading-snug text-oh-cream/70 hyphens-auto">{t("totals.friendCredit")}</dt>
            <dd data-sim-friend-credit data-value={friendCreditCents} className={`${serif} m-0 mt-1 text-[1.75rem] leading-tight md:text-4xl text-oh-cream`}>
              <CountUp to={Math.floor(friendCreditCents / 100)} prefix="$" duration={700} />
            </dd>
          </div>
        </dl>
        <p className="m-0 mt-3 text-sm text-oh-cream/60">
          {t("totals.note", { months: SIM_MONTHS, days: program.creditExpiryDays })}
        </p>
      </div>
    </div>
  );
}
