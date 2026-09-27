"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BASE_ASSUMPTIONS,
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  NO_DEBT,
  OPENING_SCHEDULE,
  SCENARIOS,
  SUBSEQUENT_UNIT_OVERRIDES,
  computeCapex,
  computeCompany,
  computeUnit,
  fmtCompact,
  fmtCurrency,
  fmtPercent,
  type CompanyYear,
  type ScenarioKey,
} from "@oh/plan-model";
import { ScenarioToggle } from "@/components/plan/controls/ScenarioToggle";
import { DataTableToggle } from "@/components/plan/primitives/DataTableToggle";
import { CHART } from "@/components/plan/charts/theme";

const YEARS = 5;
const tooltipStyle = { contentStyle: { background: CHART.ink, border: `1px solid ${CHART.stone}`, borderRadius: 6, color: CHART.cream, fontSize: 12 }, itemStyle: { color: CHART.cream }, labelStyle: { color: CHART.mute } };

/** Consolidated P&L and cash rows, in reading order (2026-09-26). Signs are as the engine reports them; costs are shown negative. */
const COMPANY_ROWS: readonly { key: keyof CompanyYear; sign: 1 | -1; strong?: boolean; rule?: boolean }[] = [
  { key: "corporateRevenue", sign: 1 },
  { key: "unitEbitda", sign: 1, strong: true },
  { key: "preOpeningExpense", sign: -1 },
  { key: "corporateOverhead", sign: -1 },
  { key: "franchiseContribution", sign: 1 },
  { key: "platformGrossProfit", sign: 1 },
  { key: "consolidatedEbitda", sign: 1, strong: true, rule: true },
  { key: "taxDistributions", sign: -1 },
  { key: "maintenanceCapex", sign: -1 },
  { key: "growthCapex", sign: -1 },
  { key: "investments", sign: -1 },
  { key: "freeCashFlow", sign: 1, strong: true, rule: true },
  { key: "equityRaised", sign: 1 },
  { key: "cumulativeCash", sign: 1, strong: true, rule: true },
];

const PLATFORM_ROWS = ["systemLocations", "licenseARR", "grossRoyalties", "royalties", "unitFees", "territoryFees", "franchiseSupportCost", "franchiseContribution", "platformGrossProfit", "companyRevenue", "systemWideSales"] as const;

/**
 * Financials (spec 5.5 to 5.10, re-based 2026-09-26): four-wall portfolio
 * P&L by year, the whole company underneath it (overhead, franchise and
 * platform profit, tax, capex, the rounds and cumulative cash with its low
 * point), the flagship ramp with its trough on purpose, capital per
 * location, and Oh! OS as a second business unit. Scenario toggle
 * recomputes everything.
 */
export function FinancialsModule({ initialScenario }: { initialScenario: ScenarioKey }) {
  const t = useTranslations("plan.financials");
  const tm = useTranslations("plan.model");
  const locale = useLocale();
  const [key, setKey] = useState<ScenarioKey>(initialScenario);
  const scenario = SCENARIOS[key];

  const data = useMemo(() => {
    const company = computeCompany({ scenario, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS }, { years: YEARS });
    const unit = computeUnit(scenario, { loan: NO_DEBT });
    const flagshipCapex = computeCapex(scenario.assumptions);
    const unitCapex = computeCapex(scenario.assumptions, SUBSEQUENT_UNIT_OVERRIDES);
    return { company, portfolio: company.portfolio, unit, platform: company.platform, flagshipCapex, unitCapex };
  }, [scenario]);

  const money = (v: number) => fmtCompact(v, { locale });
  const full = (v: number) => fmtCurrency(v, { locale });
  const yearRows = data.portfolio.years.map((y) => ({ year: t("year", { n: y.year }), revenue: y.revenue, ebitda: y.ebitda, locations: y.locationsOpenAtEnd, capex: y.capexDeployed, margin: y.revenue > 0 ? y.ebitda / y.revenue : 0 }));
  const cashRows = data.company.years.map((y) => ({ year: t("yearShort", { n: y.year }), cash: y.cumulativeCash, fcf: y.freeCashFlow, consolidated: y.consolidatedEbitda }));
  const lowest = data.company.years.reduce((min, y) => (y.cumulativeCash < min.cumulativeCash ? y : min), data.company.years[0] as CompanyYear);
  const ramp = data.unit.ramp.months.slice(0, 24).map((m) => ({ month: m.month, revenue: m.revenue, index: m.index }));
  const trough = ramp.reduce((min, r) => (r.index < min.index ? r : min), ramp[0] as (typeof ramp)[number]);
  const capexKeys = data.flagshipCapex.lines.map((l) => l.key);
  const platformRows = data.platform.years;
  const y5 = data.company.years[YEARS - 1] as CompanyYear;

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
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("company.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("company.subtitle")}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="border-b border-oh-stone text-oh-mute">
                <th className="py-2 text-left font-normal">{t("company.line")}</th>
                {data.company.years.map((y) => (
                  <th key={y.year} className="py-2 text-right font-normal">{t("yearShort", { n: y.year })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPANY_ROWS.map((r) => (
                <tr key={r.key} className={["border-b border-oh-stone", r.rule ? "border-t border-t-oh-mute/40" : "", r.strong ? "font-semibold text-oh-cream" : "text-oh-cream"].join(" ")}>
                  <th scope="row" className={["py-1.5 pr-3 text-left", r.strong ? "font-semibold" : "font-normal text-oh-mute"].join(" ")}>{t(`company.lines.${r.key}`)}</th>
                  {data.company.years.map((y) => {
                    const v = (y[r.key] as number) * r.sign;
                    return (
                      <td key={y.year} className={["py-1.5 text-right tabular-nums", v < 0 && r.strong ? "text-oh-ember-light" : ""].join(" ")}>{money(v)}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">
          {t("company.note", { overhead: money(y5.corporateOverhead), consolidated: money(y5.consolidatedEbitda), recurring: money(y5.recurringEbitda) })}
        </p>

        <h3 className="m-0 mb-1 mt-8 font-display text-[1.2rem] text-oh-cream">{t("company.runwayTitle")}</h3>
        <p className="m-0 mb-3 text-[0.82rem] text-oh-mute">{t("company.runwaySubtitle")}</p>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={cashRows} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.stone} />
              <XAxis dataKey="year" tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={{ stroke: CHART.stone }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => money(v)} tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip {...tooltipStyle} formatter={(v) => full(Number(v))} />
              <ReferenceLine y={0} stroke={CHART.clay} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="cash" name={t("company.lines.cumulativeCash")} stroke={CHART.gold} strokeWidth={2} dot={{ r: 3, fill: CHART.gold }} isAnimationActive={false} />
              <Line type="monotone" dataKey="fcf" name={t("company.lines.freeCashFlow")} stroke={CHART.olive} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <ReferenceDot x={t("yearShort", { n: lowest.year })} y={lowest.cumulativeCash} r={5} fill={lowest.cumulativeCash < 0 ? CHART.ember : CHART.cream} stroke="#1C1B19" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className={["m-0 mt-2 text-[0.8rem]", data.company.minimumCash < 0 ? "text-oh-ember-light" : "text-oh-mute"].join(" ")}>
          {data.company.minimumCash < 0 ? t("company.runwayShort", { low: money(data.company.minimumCash), year: lowest.year }) : t("company.runwayNote", { low: money(data.company.minimumCash), year: lowest.year })}
        </p>
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
          <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("capex.note", { months: scenario.assumptions.preOpeningMonths })}</p>
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
              {PLATFORM_ROWS.map((k) => (
                <tr key={k} className={["border-b border-oh-stone", k === "companyRevenue" || k === "franchiseContribution" ? "font-semibold text-oh-cream" : "text-oh-cream"].join(" ")}>
                  <td className="py-1.5 text-oh-mute">{t(`platform.lines.${k}`)}</td>
                  {platformRows.map((y) => (
                    <td key={y.year} className="py-1.5 text-right tabular-nums">{k === "systemLocations" ? y[k] : money(k === "franchiseSupportCost" ? -y[k] : y[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-3 text-[0.75rem] text-oh-mute">{t("platform.note", { pct: fmtPercent(BASE_ASSUMPTIONS.techPlatformPct, locale, 1), license: fmtCurrency(FRANCHISE_TERMS.platformLicenseMonthly, { locale }), royalty: fmtPercent(FRANCHISE_TERMS.royaltyPct, locale, 0) })}</p>
        </div>
      </section>
    </div>
  );
}
