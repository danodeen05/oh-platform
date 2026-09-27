"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  HYBRID_EXIT_MULTIPLE,
  HYBRID_RECURRING_SHARE_MIN,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  ROUND_ONE,
  ROUND_TWO,
  SBA_REFERENCE_LOAN,
  NO_DEBT,
  SCENARIOS,
  computeCapitalStack,
  computeDebtService,
  computeDscr,
  computeOwnership,
  computeOwnershipImpact,
  computeUnit,
  fmtCompact,
  fmtCurrency,
  fmtMultiple,
  fmtPercent,
  type ImpactOptions,
  type OwnershipOptions,
  type ScenarioKey,
} from "@oh/plan-model";
import { ScenarioToggle } from "@/components/plan/controls/ScenarioToggle";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";

interface SliderProps {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}
function Slider({ id, label, value, display, min, max, step, disabled, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={["py-2", disabled ? "opacity-50" : ""].join(" ")}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.78rem] tracking-wide text-oh-mute">{label}</label>
        <output htmlFor={id} className="font-display text-[1.05rem] tabular-nums text-oh-cream">{display}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-valuetext={display} onChange={(e) => onChange(Number(e.target.value))} style={{ ["--plan-range-pct" as string]: `${pct}%` }} className="h-6 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 focus:outline-none disabled:cursor-not-allowed [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-oh-cream [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-oh-ember)_var(--plan-range-pct),var(--color-oh-stone)_var(--plan-range-pct))] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-oh-ember)_var(--plan-range-pct),var(--color-oh-stone)_var(--plan-range-pct))] [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-oh-cream" />
    </div>
  );
}

const GRID_PCTS = [0.25, 0.3, 0.35, 0.4, 0.45, 0.49] as const;
const EXIT_YEARS = [5, 7] as const;

/**
 * Funding and Use of Funds (spec 6.10, owner decisions 20 to 24 and 31):
 * two equity rounds, the partnership modeler with the owner's 49% ceiling
 * and a plain statement whenever that ceiling, not the return math, sets
 * the headline; the exit at year 5 or year 7, at a restaurant multiple or
 * the hybrid platform multiple once recurring franchise profit qualifies;
 * the preferred construct on the same cash flows; the buyout option; and
 * the lender reference if one ever appears.
 */
export function FundingModule({ initialScenario }: { initialScenario: ScenarioKey }) {
  const t = useTranslations("plan.funding");
  const tm = useTranslations("plan.model");
  const locale = useLocale();
  const [key, setKey] = useState<ScenarioKey>(initialScenario);
  const [partnerPct, setPartnerPct] = useState(PARTNERSHIP_TERMS.partnerPctCap);
  const [target, setTarget] = useState(PARTNERSHIP_TERMS.targetMultiple);
  const [exitMultiple, setExitMultiple] = useState(PARTNERSHIP_TERMS.exitMultiple);
  const [distributionPct, setDistributionPct] = useState(PARTNERSHIP_TERMS.distributionPct);
  const [exitYear, setExitYear] = useState<(typeof EXIT_YEARS)[number]>(PARTNERSHIP_TERMS.exitYear === 7 ? 7 : 5);
  const [hybrid, setHybrid] = useState(false);

  const input = useMemo(() => ({ scenario: SCENARIOS[key], terms: { ...PARTNERSHIP_TERMS, distributionPct }, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS }), [key, distributionPct]);
  const exitOptions = useMemo((): OwnershipOptions => (hybrid ? { exitYear, hybrid: true } : { exitYear, exitMultiple }), [exitYear, hybrid, exitMultiple]);
  const ownership = useMemo(() => computeOwnership(input, exitOptions), [input, exitOptions]);
  const hybridOwnership = useMemo(() => computeOwnership(input, { exitYear, hybrid: true }), [input, exitYear]);
  const impactOptions = useMemo((): ImpactOptions => ({ partnerPct, targetMultiple: target, ...exitOptions }), [partnerPct, target, exitOptions]);
  const impact = useMemo(() => computeOwnershipImpact(input, impactOptions), [input, impactOptions]);
  const grid = useMemo(() => GRID_PCTS.map((p) => computeOwnershipImpact(input, { ...impactOptions, partnerPct: p })), [input, impactOptions]);
  const restaurantExit = useMemo(() => computeOwnershipImpact(input, { partnerPct, targetMultiple: target, exitYear, exitMultiple: PARTNERSHIP_TERMS.exitMultiple }), [input, partnerPct, target, exitYear]);
  const hybridExit = useMemo(() => computeOwnershipImpact(input, { partnerPct, targetMultiple: target, exitYear, hybrid: true }), [input, partnerPct, target, exitYear]);
  const rounds = [computeCapitalStack(ROUND_ONE), computeCapitalStack(ROUND_TWO)];
  const unit = useMemo(() => computeUnit(SCENARIOS[key], { loan: NO_DEBT }), [key]);
  const debtService = computeDebtService(SBA_REFERENCE_LOAN).annualDebtService;
  const sbaDscr = computeDscr(unit.location.ebitda, debtService);
  const conservativeDscr = computeDscr(computeUnit(SCENARIOS.conservative, { loan: NO_DEBT }).location.ebitda, debtService);
  const pref = ownership.preferred;

  const money = (v: number) => fmtCompact(v, { locale });
  const full = (v: number) => fmtCurrency(v, { locale });
  const pct = (v: number, d = 0) => fmtPercent(v, locale, d);
  const mult = (v: number, d = 2) => fmtMultiple(v, locale, d);
  const reset = (): void => {
    setPartnerPct(PARTNERSHIP_TERMS.partnerPctCap);
    setTarget(PARTNERSHIP_TERMS.targetMultiple);
    setExitMultiple(PARTNERSHIP_TERMS.exitMultiple);
    setDistributionPct(PARTNERSHIP_TERMS.distributionPct);
    setExitYear(5);
    setHybrid(false);
  };

  const capValues = {
    implied: pct(ownership.partnerPctReturnBased, 1),
    headline: pct(ownership.partnerPct),
    cap: pct(PARTNERSHIP_TERMS.partnerPctCap),
    target: mult(ownership.terms.targetMultiple, 1),
    multiple: mult(ownership.partnerMultipleAtHeadline),
    preferred: mult(pref.partnerMultiple),
    year: ownership.exitYear,
    ebitda: money(ownership.exitEbitda),
    exitMult: mult(ownership.exitMultiple, 1),
    exitValue: money(ownership.exitValue),
  };

  return (
    <div data-plan-module="funding" className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScenarioToggle value={key} custom={false} labels={{ conservative: tm("scenario.conservative"), base: tm("scenario.base"), aggressive: tm("scenario.aggressive"), custom: tm("scenario.custom") }} onChange={setKey} />
        <p className="m-0 text-[0.8rem] text-oh-mute">{t("hint")}</p>
      </div>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("rounds.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("rounds.subtitle")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {rounds.map((r) => (
            <div key={r.key} className="rounded-lg border border-oh-stone bg-oh-ink p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="m-0 font-display text-[1.2rem] text-oh-cream">{t(`rounds.${r.key}.title`)}</h3>
                <span className="font-display text-[1.6rem] tabular-nums text-oh-ember">{money(r.totalSources)}</span>
              </div>
              <p className="m-0 mt-1 text-[0.8rem] text-oh-mute">{t(`rounds.${r.key}.when`)}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-[0.8rem]">
                <div>
                  <p className="m-0 mb-1 text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">{t("rounds.sources")}</p>
                  {r.sources.map((s) => (
                    <div key={s.key} className="flex justify-between border-b border-oh-stone py-1">
                      <span className="text-oh-mute">{t(`rounds.keys.${s.key}`)}</span>
                      <span className="tabular-nums text-oh-cream">{money(s.amount)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="m-0 mb-1 text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">{t("rounds.uses")}</p>
                  {r.uses.map((u) => (
                    <div key={u.key} className="flex justify-between border-b border-oh-stone py-1">
                      <span className="text-oh-mute">{t(`rounds.keys.${u.key}`)}</span>
                      <span className="tabular-nums text-oh-cream">{money(u.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                {r.uses.map((u, i) => (
                  <div key={u.key} style={{ width: `${(u.amount / r.totalUses) * 100}%`, background: ["#C1502E", "#6B7355", "#C9A227", "#8C5A3C"][i % 4] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">{t("rounds.tranche")}</p>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("partner.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("partner.subtitle", { implied: pct(ownership.partnerPctReturnBased, 1), headline: pct(ownership.partnerPct), cap: pct(PARTNERSHIP_TERMS.partnerPctCap) })}</p>
        {/* The honest line: when the founder's ceiling, not the return math, sets the headline, say so and state what the partner actually gets. */}
        <div data-plan-cap-statement={ownership.cappedByOwner ? "binds" : "clear"} className={["mb-6 rounded-lg border p-4 text-[0.9rem] leading-relaxed", ownership.cappedByOwner ? "border-oh-ember bg-oh-ember/10 text-oh-cream" : "border-oh-olive bg-oh-ink text-oh-cream"].join(" ")}>
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-oh-ember-light">{ownership.cappedByOwner ? t("partner.capBindsEyebrow") : t("partner.capClearEyebrow")}</p>
          <p className="m-0 mt-1">{ownership.cappedByOwner ? t(ownership.partnerPctReturnBased >= 0.999 ? "partner.capBindsAll" : "partner.capBinds", capValues) : t("partner.capClear", capValues)}</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <div className="self-start rounded-lg border border-oh-stone bg-oh-ink p-4 md:sticky md:top-32">
            <p className="m-0 mb-1 text-[0.78rem] tracking-wide text-oh-mute">{t("exitYear.label")}</p>
            <div className="mb-2 flex gap-1" role="group" aria-label={t("exitYear.label")}>
              {EXIT_YEARS.map((y) => (
                <button key={y} type="button" aria-pressed={exitYear === y} onClick={() => setExitYear(y)} className={["flex-1 rounded-md border px-3 py-1.5 text-[0.8rem]", exitYear === y ? "border-oh-ember bg-oh-charcoal text-oh-cream" : "border-oh-stone bg-transparent text-oh-mute hover:text-oh-cream"].join(" ")}>
                  {t("year", { n: y })}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-2 py-2 text-[0.78rem] text-oh-mute">
              <input type="checkbox" checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} className="mt-0.5 accent-[var(--color-oh-ember)]" />
              <span>{t("exitYear.hybridToggle", { mult: mult(HYBRID_EXIT_MULTIPLE, 0), min: pct(HYBRID_RECURRING_SHARE_MIN) })}</span>
            </label>
            <Slider id="f-pct" label={t("partner.levers.partnerPct")} value={partnerPct} display={pct(partnerPct)} min={0.1} max={PARTNERSHIP_TERMS.partnerPctCap} step={0.01} onChange={setPartnerPct} />
            <Slider id="f-target" label={t("partner.levers.target")} value={target} display={mult(target, 1)} min={2} max={5} step={0.5} onChange={setTarget} />
            <Slider id="f-exit" label={t("partner.levers.exit")} value={hybrid ? ownership.exitMultiple : exitMultiple} display={mult(hybrid ? ownership.exitMultiple : exitMultiple, 1)} min={3} max={8} step={0.5} disabled={hybrid} onChange={setExitMultiple} />
            <Slider id="f-dist" label={t("partner.levers.distribution")} value={distributionPct} display={pct(distributionPct)} min={0} max={0.7} step={0.05} onChange={setDistributionPct} />
            <button type="button" onClick={reset} className="mt-3 rounded-md border border-oh-stone bg-transparent px-3 py-1.5 text-[0.8rem] text-oh-mute hover:text-oh-cream">
              {tm("actions.reset")}
            </button>
          </div>
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { k: "founderTotal", v: money(impact.founderTotal), accent: true, sub: t("partner.results.founderTotalSub", { dist: money(impact.founderCumulativeDistributions), exit: money(impact.founderExitProceeds) }) },
                { k: "partnerMultiple", v: mult(impact.partnerMultipleAtExit), sub: t("partner.results.partnerMultipleSub", { target: mult(target, 1), total: money(impact.partnerTotal) }) },
                { k: "buyout", v: money(impact.buyoutAtTarget), sub: impact.buyoutAtTarget > 0 ? t("partner.results.buyoutSub", { ratio: mult(impact.buyoutVsMarket) }) : t("partner.results.buyoutFree") },
                { k: "targetYear", v: impact.targetYearFromDistributions ? t("year", { n: impact.targetYearFromDistributions }) : t("partner.results.beyond", { n: exitYear }), sub: t("partner.results.targetYearSub") },
              ].map((c) => (
                <div key={c.k} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-4">
                  <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t(`partner.results.${c.k}`, { n: exitYear })}</p>
                  <p className={["m-0 mt-1 font-display text-[1.7rem] leading-none tabular-nums", c.accent ? "text-oh-ember" : "text-oh-cream"].join(" ")}>{c.v}</p>
                  <p className="m-0 mt-2 text-[0.75rem] leading-snug text-oh-mute">{c.sub}</p>
                </div>
              ))}
            </div>

            <h3 className="m-0 mb-2 mt-8 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("partner.yearly")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr className="border-b border-oh-stone text-oh-mute">
                    <th className="py-1.5 text-left font-normal">{t("partner.cols.year")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.ebitda")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.consolidated")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.distributable")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.distributions")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.founder")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.partner")}</th>
                    <th className="py-1.5 text-right font-normal">{t("partner.cols.multiple")}</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.years.map((y) => (
                    <tr key={y.year} className="border-b border-oh-stone text-oh-cream">
                      <td className="py-1.5">{t("year", { n: y.year })}</td>
                      <td className="py-1.5 text-right tabular-nums text-oh-mute">{full(y.corporateEbitda)}</td>
                      <td className={["py-1.5 text-right tabular-nums", y.consolidatedEbitda < 0 ? "text-oh-ember-light" : "text-oh-mute"].join(" ")}>{full(y.consolidatedEbitda)}</td>
                      <td className="py-1.5 text-right tabular-nums text-oh-mute">{full(y.distributable)}</td>
                      <td className="py-1.5 text-right tabular-nums">{full(y.distributions)}</td>
                      <td className="py-1.5 text-right tabular-nums text-oh-olive-light">{full(y.founderDistribution)}</td>
                      <td className="py-1.5 text-right tabular-nums">{full(y.partnerDistribution)}</td>
                      <td className="py-1.5 text-right tabular-nums text-oh-mute">{mult(y.partnerMultipleToDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="m-0 mb-2 mt-8 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("partner.grid", { target: mult(target, 1), exit: mult(ownership.exitMultiple, 1) })}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr className="border-b border-oh-stone text-oh-mute">
                    <th className="py-1.5 text-left font-normal">{t("partner.cols.stake")}</th>
                    {grid.map((g) => (
                      <th key={g.partnerPct} className={["py-1.5 text-right font-normal tabular-nums", Math.abs(g.partnerPct - partnerPct) < 0.005 ? "text-oh-gold" : ""].join(" ")}>{pct(g.partnerPct)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["founderTotal", (g: (typeof grid)[number]) => money(g.founderTotal)],
                    ["founderExit", (g: (typeof grid)[number]) => money(g.founderExitProceeds)],
                    ["partnerMultiple", (g: (typeof grid)[number]) => mult(g.partnerMultipleAtExit)],
                    ["buyout", (g: (typeof grid)[number]) => money(g.buyoutAtTarget)],
                  ] as const).map(([k, f]) => (
                    <tr key={k} className="border-b border-oh-stone text-oh-cream">
                      <th scope="row" className="py-1.5 text-left font-normal text-oh-mute">{t(`partner.gridRows.${k}`)}</th>
                      {grid.map((g) => (
                        <td key={g.partnerPct} className={["py-1.5 text-right tabular-nums", g.partnerMultipleAtExit < target && k === "partnerMultiple" ? "text-oh-ember-light" : ""].join(" ")}>{f(g)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("partner.gridNote")}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("preferred.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("preferred.subtitle", { pref: pct(pref.preferredReturnPct), liq: mult(pref.liquidationPreference, 0), cap: pct(PARTNERSHIP_TERMS.partnerPctCap), year: ownership.exitYear })}</p>
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <table className="w-full border-collapse text-[0.85rem]">
            <tbody>
              {([
                ["accruedPreference", money(pref.accruedPreference)],
                ["preferencePaidFromDistributions", money(pref.preferencePaidFromDistributions)],
                ["preferencePaidAtExit", money(pref.preferencePaidAtExit)],
                ["liquidationPaid", money(pref.liquidationPaid)],
                ["residualExitValue", money(pref.residualExitValue)],
                ["commonDistributions", money(pref.commonDistributions)],
              ] as const).map(([k, v]) => (
                <tr key={k} className="border-b border-oh-stone text-oh-cream">
                  <th scope="row" className="py-1.5 text-left font-normal text-oh-mute">{t(`preferred.rows.${k}`)}</th>
                  <td className="py-1.5 text-right tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: "partnerCommonPct", v: pct(pref.partnerCommonPct), sub: pref.cappedByOwner ? t("preferred.commonCapped", { implied: pct(pref.partnerCommonPctReturnBased, 1) }) : t("preferred.commonClear", { implied: pct(pref.partnerCommonPctReturnBased, 1) }) },
              { k: "partnerMultiple", v: mult(pref.partnerMultiple), sub: t("preferred.partnerMultipleSub", { total: money(pref.partnerTotal) }) },
              { k: "founderTotal", v: money(pref.founderTotal), accent: true, sub: t("preferred.founderTotalSub", { pct: pct(pref.founderCommonPct) }) },
              { k: "versusCommon", v: mult(ownership.partnerMultipleAtHeadline), sub: t("preferred.versusCommonSub", { headline: pct(ownership.partnerPct) }) },
            ].map((c) => (
              <div key={c.k} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-4">
                <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t(`preferred.cards.${c.k}`)}</p>
                <p className={["m-0 mt-1 font-display text-[1.6rem] leading-none tabular-nums", c.accent ? "text-oh-ember" : "text-oh-cream"].join(" ")}>{c.v}</p>
                <p className="m-0 mt-2 text-[0.75rem] leading-snug text-oh-mute">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">{t("preferred.note")}</p>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("exit.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("exit.subtitle", { year: exitYear })}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { k: "restaurant", i: restaurantExit, m: PARTNERSHIP_TERMS.exitMultiple },
            { k: "hybrid", i: hybridExit, m: HYBRID_EXIT_MULTIPLE },
          ].map(({ k, i, m }) => (
            <div key={k} className={["rounded-lg border p-5", k === "hybrid" ? (hybridOwnership.hybridEligible ? "border-oh-gold bg-oh-ink" : "border-dashed border-oh-stone bg-oh-ink") : "border-oh-stone bg-oh-ink"].join(" ")}>
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{t(`exit.${k}`, { mult: mult(m, 0) })}</p>
              <p className="m-0 mt-1 font-display text-[2rem] leading-none tabular-nums text-oh-cream">{money(i.exitValue)}</p>
              <div className="mt-3 h-2 rounded-full bg-oh-charcoal">
                <div className="h-2 rounded-full bg-oh-ember" style={{ width: `${Math.min(100, (i.exitValue / Math.max(1, Math.max(restaurantExit.exitValue, hybridExit.exitValue))) * 100)}%` }} />
              </div>
              <dl className="m-0 mt-3 grid grid-cols-2 gap-2 text-[0.8rem]">
                <div><dt className="text-oh-mute">{t("exit.founderShare")}</dt><dd className="m-0 tabular-nums text-oh-cream">{money(i.founderExitProceeds)}</dd></div>
                <div><dt className="text-oh-mute">{t("exit.partnerMultiple")}</dt><dd className="m-0 tabular-nums text-oh-cream">{mult(i.partnerMultipleAtExit)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">
          {hybridOwnership.hybridEligible
            ? t(hybridOwnership.recurringFranchiseShare >= 1 ? "exit.eligibleOver" : "exit.eligible", { share: pct(hybridOwnership.recurringFranchiseShare), min: pct(HYBRID_RECURRING_SHARE_MIN), delta: money(hybridExit.exitValue - restaurantExit.exitValue) })
            : t("exit.notEligible", { share: pct(hybridOwnership.recurringFranchiseShare), min: pct(HYBRID_RECURRING_SHARE_MIN), year: exitYear })}
        </p>
      </section>

      <BenchmarkCallout eyebrow={t("lender.eyebrow")} claim={t("lender.claim")} benchmark={t("lender.text", { dscr: fmtMultiple(sbaDscr, locale, 1), conservative: fmtMultiple(conservativeDscr, locale, 1), debt: money(SBA_REFERENCE_LOAN.principal) })} />
    </div>
  );
}
