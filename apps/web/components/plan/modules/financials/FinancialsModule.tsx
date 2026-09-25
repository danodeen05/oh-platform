"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  NO_DEBT,
  OPENING_SCHEDULE,
  SCENARIOS,
  SUBSEQUENT_UNIT_OVERRIDES,
  computeCapex,
  computePlatform,
  computePortfolio,
  computeUnit,
  fmtCompact,
  fmtCurrency,
  fmtPercent,
  type ScenarioKey,
} from "@oh/plan-model";
import { ScenarioToggle } from "@/components/plan/controls/ScenarioToggle";
import { DataTableToggle } from "@/components/plan/primitives/DataTableToggle";
import { CHART } from "@/components/plan/charts/theme";

const YEARS = 5;
const tooltipStyle = { contentStyle: { background: CHART.ink, border: `1px solid ${CHART.stone}`, borderRadius: 6, color: CHART.cream, fontSize: 12 }, itemStyle: { color: CHART.cream }, labelStyle: { color: CHART.mute } };

/**
 * Financials (spec 5.5 to 5.10): portfolio P&L by year, the flagship ramp
 * with its trough on purpose, capital per location, and Oh! OS as a second
 * business unit. Scenario toggle recomputes everything.
 */
export function FinancialsModule({ initialScenario }: { initialScenario: ScenarioKey }) {
  const t = useTranslations("plan.financials");
  const tm = useTranslations("plan.model");
  const locale = useLocale();
  const [key, setKey] = useState<ScenarioKey>(initialScenario);
  const scenario = SCENARIOS[key];

  const data = useMemo(() => {
    const portfolio = computePortfolio(OPENING_SCHEDULE, scenario, { years: YEARS });
    const unit = computeUnit(scenario, { loan: NO_DEBT });
    const platform = computePlatform({
      corporate: portfolio.years.map((y) => ({ year: y.year, corporateRevenue: y.revenue, corporateLocationsAtEnd: y.locationsOpenAtEnd })),
      markets: FRANCHISE_MARKETS,
      terms: FRANCHISE_TERMS,
      unitSteadyRevenue: unit.location.annualRevenue,
      ramp: scenario.assumptions,
      techPlatformPct: scenario.assumptions.techPlatformPct,
    });
    const flagshipCapex = computeCapex(scenario.assumptions);
    const unitCapex = computeCapex(scenario.assumptions, SUBSEQUENT_UNIT_OVERRIDES);
    return { portfolio, unit, platform, flagshipCapex, unitCapex };
  }, [scenario]);

  const money = (v: number) => fmtCompact(v, { locale });
  const full = (v: number) => fmtCurrency(v, { locale });
  const yearRows = data.portfolio.years.map((y) => ({ year: t("year", { n: y.year }), revenue: y.revenue, ebitda: y.ebitda, locations: y.locationsOpenAtEnd, capex: y.capexDeployed, margin: y.revenue > 0 ? y.ebitda / y.revenue : 0 }));
  const ramp = data.unit.ramp.months.slice(0, 24).map((m) => ({ month: m.month, revenue: m.revenue, index: m.index }));
  const trough = ramp.reduce((min, r) => (r.index < min.index ? r : min), ramp[0] as (typeof ramp)[number]);
  const capexKeys = data.flagshipCapex.lines.map((l) => l.key);
  const platformRows = data.platform.years;

  return (
    <div data-plan-module="financials" className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScenarioToggle value={key} custom={false} labels={{ conservative: tm("scenario.conservative"), base: tm("scenario.base"), aggressive: tm("scenario.aggressive"), custom: tm("scenario.custom") }} onChange={setKey} />
        <p className="m-0 text-[0.8rem] text-oh-mute">{t("hint")}</p>
      </div>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("portfolio.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("portfolio.subtitle")}</p>
        <DataTableToggle
          labels={{ showTable: tm("table.show"), showChart: tm("table.hide") }}
          chart={
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={yearRows} margin={{ top: 16, right: 8, left: 8, bottom: 0 }} barGap={4}>
                  <CartesianGrid vertical={false} stroke={CHART.stone} />
                  <XAxis dataKey="year" tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={{ stroke: CHART.stone }} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => money(v)} tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip {...tooltipStyle} formatter={(v) => full(Number(v))} cursor={{ fill: "rgba(242,237,228,0.04)" }} />
                  <Bar dataKey="revenue" name={t("portfolio.revenue")} fill={CHART.ember} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="ebitda" name={t("portfolio.ebitda")} fill={CHART.olive} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={
            <table className="w-full border-collapse text-[0.85rem]">
              <thead>
                <tr className="border-b border-oh-stone text-oh-mute">
                  <th className="py-2 text-left font-normal">{t("portfolio.yearCol")}</th>
                  <th className="py-2 text-right font-normal">{t("portfolio.locations")}</th>
                  <th className="py-2 text-right font-normal">{t("portfolio.revenue")}</th>
                  <th className="py-2 text-right font-normal">{t("portfolio.ebitda")}</th>
                  <th className="py-2 text-right font-normal">{t("portfolio.margin")}</th>
                  <th className="py-2 text-right font-normal">{t("portfolio.capex")}</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.year} className="border-b border-oh-stone text-oh-cream">
                    <td className="py-2">{r.year}</td>
                    <td className="py-2 text-right tabular-nums">{r.locations}</td>
                    <td className="py-2 text-right tabular-nums">{full(r.revenue)}</td>
                    <td className="py-2 text-right tabular-nums">{full(r.ebitda)}</td>
                    <td className="py-2 text-right tabular-nums text-oh-mute">{fmtPercent(r.margin, locale, 1)}</td>
                    <td className="py-2 text-right tabular-nums text-oh-mute">{full(r.capex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("ramp.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("ramp.subtitle")}</p>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={ramp} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.stone} />
              <XAxis dataKey="month" tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={{ stroke: CHART.stone }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => money(v)} tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={false} tickLine={false} width={64} domain={["dataMin - 40000", "dataMax + 40000"]} />
              <Tooltip {...tooltipStyle} formatter={(v) => full(Number(v))} labelFormatter={(l) => t("ramp.month", { n: String(l ?? "") })} />
              <Line type="monotone" dataKey="revenue" stroke={CHART.ember} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceDot x={trough.month} y={trough.revenue} r={5} fill={CHART.gold} stroke="#1C1B19" label={{ value: t("ramp.trough"), position: "bottom", fill: CHART.gold, fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="m-0 mt-2 text-[0.8rem] text-oh-mute">{t("ramp.note", { y1: money(data.unit.ramp.years[0]?.revenue ?? 0), y2: money(data.unit.ramp.years[1]?.revenue ?? 0) })}</p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("capex.title")}</h2>
          <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("capex.subtitle")}</p>
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 text-left font-normal">{t("capex.line")}</th>
                <th className="py-2 text-right font-normal">{t("capex.flagship")}</th>
                <th className="py-2 text-right font-normal">{t("capex.subsequent")}</th>
              </tr>
            </thead>
            <tbody>
              {capexKeys.map((k, i) => (
                <tr key={k} className="border-b border-oh-stone text-oh-cream">
                  <td className="py-1.5 text-oh-mute">{t(`capex.lines.${k}`)}</td>
                  <td className="py-1.5 text-right tabular-nums">{full(data.flagshipCapex.lines[i]?.amount ?? 0)}</td>
                  <td className="py-1.5 text-right tabular-nums">{full(data.unitCapex.lines[i]?.amount ?? 0)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-oh-cream">
                <td className="py-2">{t("capex.total")}</td>
                <td className="py-2 text-right tabular-nums">{full(data.flagshipCapex.total)}</td>
                <td className="py-2 text-right tabular-nums">{full(data.unitCapex.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("platform.title")}</h2>
          <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("platform.subtitle")}</p>
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 text-left font-normal">{t("platform.line")}</th>
                {platformRows.map((y) => (
                  <th key={y.year} className="py-2 text-right font-normal">{t("yearShort", { n: y.year })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["systemLocations", "licenseARR", "royalties", "unitFees", "territoryFees", "platformGrossProfit", "companyRevenue", "systemWideSales"] as const).map((k) => (
                <tr key={k} className={["border-b border-oh-stone", k === "companyRevenue" ? "font-semibold text-oh-cream" : "text-oh-cream"].join(" ")}>
                  <td className="py-1.5 text-oh-mute">{t(`platform.lines.${k}`)}</td>
                  {platformRows.map((y) => (
                    <td key={y.year} className="py-1.5 text-right tabular-nums">{k === "systemLocations" ? y[k] : money(y[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-3 text-[0.75rem] text-oh-mute">{t("platform.note", { pct: fmtPercent(BASE_ASSUMPTIONS.techPlatformPct, locale, 1), license: fmtCurrency(FRANCHISE_TERMS.platformLicenseMonthly, { locale }) })}</p>
        </div>
      </section>
    </div>
  );
}
