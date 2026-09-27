"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { BASE_ASSUMPTIONS, COVERAGE_SCHEDULE, computeCapex, computeLocation, coverageHoursPerDay, fmtCurrency, fmtInteger, fmtPercent } from "@oh/plan-model";
import { PlanPhoto } from "@/components/plan/primitives/PlanPhoto";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { CHART } from "@/components/plan/charts/theme";
import { FOUNDATION } from "@/components/plan/modules/foundation/contact";

const STATES = ["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING"] as const;
/**
 * The day, hour by hour. Head counts and paid hours come from the engine's
 * coverage schedule (labor.ts); only the clock-in times live here, so the
 * roster on this page and the FTE in the labor line can never disagree.
 */
const SHIFT_START: Record<string, number> = { broth: 6, noodle: 10, assembly: 10.5, runner: 10.5, peak: 11.5, close: 18 };
const MANAGEMENT = [
  { key: "gm", from: 8, to: 18 },
  { key: "agm", from: 12, to: 22 },
] as const;
const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i);

const NODES = [
  { key: "web", x: 10, y: 20, w: 118, h: 46 },
  { key: "kiosk", x: 138, y: 20, w: 118, h: 46 },
  { key: "status", x: 266, y: 20, w: 118, h: 46 },
  { key: "admin", x: 394, y: 20, w: 126, h: 46 },
  { key: "api", x: 130, y: 120, w: 270, h: 52 },
  { key: "db", x: 20, y: 220, w: 170, h: 46 },
  { key: "stripe", x: 210, y: 220, w: 130, h: 46 },
  { key: "clerk", x: 360, y: 220, w: 150, h: 46 },
] as const;

/**
 * Operations and Technology (spec 6.8): the platform in plain words, the
 * pod lifecycle, the kitchen display slot, the labor model hour by hour,
 * commissary and broth consistency, and the food-safety pathway.
 */
export function OperationsModule() {
  const t = useTranslations("plan.operations");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % STATES.length), 1800);
    return () => window.clearInterval(id);
  }, [reduce]);
  const a = BASE_ASSUMPTIONS;
  const kitchenAnnual = a.kitchenFTE * a.avgKitchenWage * a.annualHoursPerFTE;
  const mgmtAnnual = a.managerFTE * a.avgManagerSalary;
  const hoursPerDay = coverageHoursPerDay(COVERAGE_SCHEDULE);
  const heads = COVERAGE_SCHEDULE.shifts.reduce((n, sh) => n + sh.count, 0);
  const loc = computeLocation(a);
  // Owner decision 2026-09-26 (finding C2): the member program is a budget line, not a promise.
  const programBudget = loc.memberProgram;
  const launch = computeCapex(a).lines.find((l) => l.key === "launchMarketing")?.amount ?? 0;
  const programValues = {
    budget: fmtCurrency(programBudget, { locale }),
    pct: fmtPercent(a.memberProgramPct, locale, 1),
    allIn: fmtPercent(loc.memberProgram / loc.annualRevenue, locale, 1),
    swag: fmtCurrency(a.memberSwagAnnual, { locale }),
    launch: fmtCurrency(launch, { locale }),
    marketing: fmtPercent(a.marketingPct, locale, 0),
    comps: fmtPercent(a.discountsCompsPct, locale, 1),
  };
  // Owner decision 2026-09-27: 1% of revenue to ONE RED STEP AT A TIME, an opex line in every scenario.
  const givingValues = {
    pct: fmtPercent(a.communityGivingPct, locale, 0),
    budget: fmtCurrency(loc.communityGiving, { locale }),
    monthly: fmtCurrency(loc.communityGiving / 12, { locale }),
    name: FOUNDATION.name,
  };

  return (
    <div data-plan-module="operations" className="flex flex-col gap-14">
      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("platform.title")}</h2>
          <p className="m-0 text-[0.9rem] leading-relaxed text-oh-mute">{t("platform.body")}</p>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-[0.85rem]">
            {NODES.map((n) => (
              <li key={n.key} className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-oh-stone pb-1.5">
                <span className="text-oh-cream">{t(`platform.nodes.${n.key}.name`)}</span>
                <span className="text-oh-mute">{t(`platform.nodes.${n.key}.role`)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg border border-oh-gold/40 bg-oh-ink/60 p-4">
            <p className="m-0 font-display text-[1.1rem] text-oh-cream">{t("platform.guestPhone.title")}</p>
            <p className="m-0 mt-1 text-[0.85rem] leading-relaxed text-oh-mute">{t("platform.guestPhone.body")}</p>
          </div>
        </div>
        <svg viewBox="0 0 530 290" className="block h-auto w-full" role="img" aria-label={t("platform.aria")}>
          {[["web", "api"], ["kiosk", "api"], ["status", "api"], ["admin", "api"], ["api", "db"], ["api", "stripe"], ["api", "clerk"]].map(([from, to]) => {
            const f = NODES.find((n) => n.key === from) as (typeof NODES)[number];
            const g = NODES.find((n) => n.key === to) as (typeof NODES)[number];
            return <line key={`${from}-${to}`} x1={f.x + f.w / 2} y1={f.y + f.h} x2={g.x + g.w / 2} y2={g.y} stroke={CHART.stone} strokeWidth={1.5} />;
          })}
          {NODES.map((n) => (
            <g key={n.key}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} fill={n.key === "api" ? "rgba(193,80,46,0.18)" : CHART.ink} stroke={n.key === "api" ? CHART.ember : CHART.stone} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle" fill={CHART.cream} fontSize={12}>{t(`platform.nodes.${n.key}.name`)}</text>
            </g>
          ))}
        </svg>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("lifecycle.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("lifecycle.subtitle")}</p>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-4" aria-live="off">
          {STATES.map((s, i) => (
            <li key={s} className={["rounded-lg border p-4 transition-colors", i === active ? "border-oh-ember bg-oh-ink" : "border-oh-stone bg-transparent"].join(" ")}>
              <p className={["m-0 text-[0.68rem] uppercase tracking-[0.16em]", i === active ? "text-oh-ember-light" : "text-oh-mute"].join(" ")}>{s}</p>
              <p className="m-0 mt-1 font-display text-[1.1rem] text-oh-cream">{t(`lifecycle.states.${s}.title`)}</p>
              <p className="m-0 mt-1 text-[0.78rem] leading-snug text-oh-mute">{t(`lifecycle.states.${s}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr]">
        <PlanPhoto src="/plan/operations-kds.webp" alt={t("kds.needs")} width={1600} height={932} caption={t("kds.caption")} />
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("kds.title")}</h2>
          <p className="m-0 text-[0.9rem] leading-relaxed text-oh-mute">{t("kds.body")}</p>
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("labor.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("labor.subtitle", { heads, hours: fmtInteger(hoursPerDay, locale), days: fmtInteger(a.operatingDaysPerYear, locale), kitchen: a.kitchenFTE.toFixed(1), mgmt: a.managerFTE, wage: fmtCurrency(a.avgKitchenWage, { locale, fractionDigits: 2 }), salary: fmtCurrency(a.avgManagerSalary, { locale }), kitchenAnnual: fmtCurrency(kitchenAnnual, { locale }), mgmtAnnual: fmtCurrency(mgmtAnnual, { locale }), burden: fmtInteger(a.payrollBurdenPct * 100, locale), coverage: fmtInteger(a.coverageFactorPct * 100, locale) })}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 pr-3 text-left font-normal">{t("labor.role")}</th>
                <th className="py-2 pr-3 text-right font-normal">{t("labor.count")}</th>
                <th className="py-2 pr-3 text-right font-normal">{t("labor.hoursEach")}</th>
                {HOURS.map((h) => (<th key={h} className="px-0 py-2 text-center font-normal tabular-nums text-[0.65rem]">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {COVERAGE_SCHEDULE.shifts.map((sh) => {
                const from = SHIFT_START[sh.key] ?? 0;
                const to = from + sh.hours;
                return (
                  <tr key={sh.key} className="border-b border-oh-stone">
                    <td className="py-1.5 pr-3 text-oh-cream">{t(`labor.roles.${sh.key}`)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-oh-cream">{sh.count}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-oh-mute">{sh.hours}</td>
                    {HOURS.map((h) => (<td key={h} className="p-0.5"><div className={["h-3 rounded-sm", h + 0.5 > from && h < to ? "bg-oh-ember/80" : "bg-oh-ink"].join(" ")} /></td>))}
                  </tr>
                );
              })}
              {MANAGEMENT.map((m) => (
                <tr key={m.key} className="border-b border-oh-stone">
                  <td className="py-1.5 pr-3 text-oh-cream">{t(`labor.roles.${m.key}`)}<span className="ml-2 text-oh-mute">{t("labor.salaried")}</span></td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-oh-cream">1</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-oh-mute"></td>
                  {HOURS.map((h) => (<td key={h} className="p-0.5"><div className={["h-3 rounded-sm", h + 0.5 > m.from && h < m.to ? "bg-oh-gold/70" : "bg-oh-ink"].join(" ")} /></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("labor.note", { crossTraining: COVERAGE_SCHEDULE.crossTrainingHours, hours: fmtInteger(hoursPerDay, locale) })}</p>
      </section>

      <section className="rounded-lg border border-oh-stone bg-oh-ink p-5 md:p-6">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("program.eyebrow")}</p>
        <h2 className="m-0 mt-1 font-display text-[1.5rem] text-oh-cream">{t("program.title")}</h2>
        <p className="m-0 mt-3 max-w-3xl text-[0.92rem] leading-relaxed text-oh-mute">{t("program.body", programValues)}</p>
        <ul className="m-0 mt-4 grid list-none gap-3 p-0 md:grid-cols-2">
          {(["cashback", "referral", "challenges", "perks", "swag", "comps"] as const).map((k) => (
            <li key={k} className="border-l-2 border-oh-stone pl-3">
              <p className="m-0 font-display text-[1rem] text-oh-cream">{t(`program.items.${k}.title`)}</p>
              <p className="m-0 mt-1 text-[0.8rem] leading-snug text-oh-mute">{t(`program.items.${k}.body`, programValues)}</p>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-4 text-[0.8rem] leading-relaxed text-oh-mute">{t("program.launch", programValues)}</p>
      </section>

      <section data-plan-giving="" className="grid gap-5 rounded-lg border border-oh-stone bg-oh-ink p-5 md:grid-cols-[auto_minmax(0,1fr)] md:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FOUNDATION.logo.src} alt={FOUNDATION.logo.alt} width={FOUNDATION.logo.width} height={FOUNDATION.logo.height} className="h-16 w-16 rounded-md bg-white object-contain p-1" />
        <div className="min-w-0">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("giving.eyebrow")}</p>
          <h2 className="m-0 mt-1 font-display text-[1.5rem] text-oh-cream">{t("giving.title")}</h2>
          <p className="m-0 mt-3 max-w-3xl text-[0.92rem] leading-relaxed text-oh-mute">{t("giving.body", givingValues)}</p>
          <p className="m-0 mt-2 max-w-3xl text-[0.8rem] leading-relaxed text-oh-mute">{t("giving.cadence", givingValues)}</p>
          <a href={FOUNDATION.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[0.85rem] text-oh-ember-light underline-offset-2 hover:underline">
            {t("giving.link")}
          </a>
        </div>
      </section>

      <BenchmarkCallout eyebrow={t("commissary.eyebrow")} claim={t("commissary.claim")} benchmark={t("commissary.text")} />

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("safety.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("safety.subtitle")}</p>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
          {(["planReview", "haccp", "manager", "inspection", "fireMarshal", "occupancy"] as const).map((k, i) => (
            <li key={k} className="rounded-lg border border-oh-stone bg-oh-ink p-4">
              <p className="m-0 font-display text-[0.9rem] tabular-nums text-oh-ember-light">{String(i + 1).padStart(2, "0")}</p>
              <p className="m-0 mt-1 font-display text-[1.05rem] text-oh-cream">{t(`safety.steps.${k}.title`)}</p>
              <p className="m-0 mt-1 text-[0.8rem] leading-snug text-oh-mute">{t(`safety.steps.${k}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
