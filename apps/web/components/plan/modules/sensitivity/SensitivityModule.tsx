"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  NO_DEBT,
  SCENARIOS,
  computeLocation,
  computeRamp,
  computeUnit,
  fmtCompact,
  fmtCurrency,
  fmtPercent,
  heatGrid,
  tornado,
  withLever,
  type LeverKey,
  type LocationAssumptions,
  type ScenarioKey,
  type TriangularDist,
} from "@oh/plan-model";
import { ScenarioToggle } from "@/components/plan/controls/ScenarioToggle";
import { DataTableToggle } from "@/components/plan/primitives/DataTableToggle";
import { CHART } from "@/components/plan/charts/theme";
import type { McResponse } from "./mc.worker";

const MC_RUNS = 10_000;

function ranges(a: LocationAssumptions) {
  return [
    { key: "utilizationRate" as LeverKey, low: a.utilizationRate * 0.8, high: a.utilizationRate * 1.2 },
    { key: "avgBowlPrice" as LeverKey, low: a.avgBowlPrice - 2, high: a.avgBowlPrice + 2 },
    { key: "foodCostPct" as LeverKey, low: a.foodCostPct + 0.03, high: a.foodCostPct - 0.03 },
    { key: "rentPerSqFtAnnual" as LeverKey, low: a.rentPerSqFtAnnual + 10, high: a.rentPerSqFtAnnual - 10 },
    { key: "kitchenFTE" as LeverKey, low: a.kitchenFTE + 2, high: a.kitchenFTE - 2 },
    { key: "avgDwellMinutes" as LeverKey, low: a.avgDwellMinutes + 5, high: a.avgDwellMinutes - 5 },
    { key: "pods" as LeverKey, low: a.pods - 10, high: a.pods + 10 },
    { key: "payrollBurdenPct" as LeverKey, low: a.payrollBurdenPct + 0.04, high: a.payrollBurdenPct - 0.04 },
  ];
}
function dists(a: LocationAssumptions): TriangularDist[] {
  return [
    // Symmetric on the two revenue levers, skewed against us on costs: neutral, not flattering.
    { key: "utilizationRate", min: a.utilizationRate * 0.75, mode: a.utilizationRate, max: a.utilizationRate * 1.25 },
    { key: "avgBowlPrice", min: a.avgBowlPrice - 2, mode: a.avgBowlPrice, max: a.avgBowlPrice + 2 },
    { key: "foodCostPct", min: a.foodCostPct - 0.02, mode: a.foodCostPct, max: a.foodCostPct + 0.04 },
    { key: "rentPerSqFtAnnual", min: a.rentPerSqFtAnnual - 4, mode: a.rentPerSqFtAnnual, max: a.rentPerSqFtAnnual + 10 },
    { key: "kitchenFTE", min: a.kitchenFTE - 1, mode: a.kitchenFTE, max: a.kitchenFTE + 2 },
  ];
}

const DOWNSIDES = [
  { key: "slowRamp", apply: (a: LocationAssumptions) => ({ ...a, rampCurve: a.rampCurve.map((x) => x * 0.85), rampPlateau: a.rampPlateau * 0.95 }), headline: "y1" as const },
  { key: "rentInflation", apply: (a: LocationAssumptions) => withLever(a, "rentPerSqFtAnnual", a.rentPerSqFtAnnual + 15) },
  { key: "beefSpike", apply: (a: LocationAssumptions) => withLever(a, "foodCostPct", a.foodCostPct + 0.05) },
  { key: "copycat", apply: (a: LocationAssumptions) => withLever(a, "utilizationRate", a.utilizationRate * 0.8) },
  { key: "podReliability", apply: (a: LocationAssumptions) => withLever(withLever(a, "repairsMaintPct", a.repairsMaintPct + 0.015), "pods", a.pods - 5) },
  { key: "laborShock", apply: (a: LocationAssumptions) => withLever(withLever(a, "avgKitchenWage", a.avgKitchenWage + 3), "kitchenFTE", a.kitchenFTE + 1) },
] as const;

/**
 * Sensitivity and Risk (spec 6.5): tornado, utilization × price heat grid
 * with the break-even contour, a 10,000-run Monte Carlo in a Web Worker,
 * and six named downside scenarios with their EBITDA impact and mitigation.
 */
export function SensitivityModule({ initialScenario }: { initialScenario: ScenarioKey }) {
  const t = useTranslations("plan.sensitivity");
  const tm = useTranslations("plan.model");
  const locale = useLocale();
  const [key, setKey] = useState<ScenarioKey>(initialScenario);
  const a = SCENARIOS[key].assumptions;
  const base = useMemo(() => computeLocation(a), [a]);
  const torn = useMemo(() => tornado(a, ranges(a)), [a]);
  const utilValues = [0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42];
  const priceValues = [14, 15.5, 17, 18.5, 20, 21.5, 23, 24.5, 26];
  const grid = useMemo(() => heatGrid(a, { key: "utilizationRate", values: utilValues }, { key: "avgBowlPrice", values: priceValues }), [a]);
  const [mc, setMc] = useState<McResponse | null>(null);
  const [mcState, setMcState] = useState<"idle" | "running" | "done" | "unavailable">("idle");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setMc(null);
    setMcState("running");
    let worker: Worker;
    try {
      worker = new Worker(new URL("./mc.worker.ts", import.meta.url));
    } catch {
      setMcState("unavailable");
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<McResponse>) => {
      setMc(e.data);
      setMcState("done");
    };
    worker.onerror = () => setMcState("unavailable");
    worker.postMessage({ assumptions: a, dists: dists(a), runs: MC_RUNS, seed: 20260925, threshold: base.annualRevenue * 0.25 });
    return () => worker.terminate();
  }, [a, base.annualRevenue]);

  const money = (v: number) => fmtCompact(v, { locale });
  const full = (v: number) => fmtCurrency(v, { locale });
  const downsides = useMemo(
    () =>
      DOWNSIDES.map((d) => {
        const stressed = d.apply(a);
        const loc = computeLocation(stressed);
        const y1 = computeRamp(stressed, { months: 12 }).years[0]?.ebitda ?? 0;
        const y1Base = computeRamp(a, { months: 12 }).years[0]?.ebitda ?? 0;
        const steadyDelta = loc.ebitda - base.ebitda;
        const y1Delta = y1 - y1Base;
        return { key: d.key, ebitdaDelta: steadyDelta, marginAfter: loc.ebitdaMarginPct, y1Delta, headline: "headline" in d && d.headline === "y1" ? y1Delta : steadyDelta, headlineIsY1: "headline" in d && d.headline === "y1" };
      }),
    [a, base.ebitda],
  );
  const payback = computeUnit(SCENARIOS[key], { loan: NO_DEBT }).ramp.payback.fromOpening;

  const gridMax = Math.max(Math.abs(grid.min), Math.abs(grid.max));
  const cellColor = (v: number): string => {
    if (v < 0) return `rgba(193,80,46,${Math.min(1, 0.25 + (Math.abs(v) / gridMax) * 0.75)})`;
    return `rgba(107,115,85,${Math.min(0.82, 0.12 + (v / gridMax) * 0.7)})`;
  };
  const tornadoMax = Math.max(...torn.bars.map((b) => Math.max(Math.abs(b.atLow - torn.base), Math.abs(b.atHigh - torn.base))), 1);

  return (
    <div data-plan-module="sensitivity" className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScenarioToggle value={key} custom={false} labels={{ conservative: tm("scenario.conservative"), base: tm("scenario.base"), aggressive: tm("scenario.aggressive"), custom: tm("scenario.custom") }} onChange={setKey} />
        <p className="m-0 text-[0.8rem] text-oh-mute">{t("hint", { ebitda: money(base.ebitda), payback: payback === null ? "n/a" : payback.toFixed(1) })}</p>
      </div>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("tornado.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("tornado.subtitle", { base: money(torn.base) })}</p>
        <DataTableToggle
          labels={{ showTable: tm("table.show"), showChart: tm("table.hide") }}
          chart={
            <svg viewBox="0 0 800 300" className="block h-auto w-full" role="img" aria-label={t("tornado.aria")}>
              {torn.bars.map((b, i) => {
                const y = 12 + i * 34;
                const cx = 540;
                const scale = 230 / tornadoMax;
                const lowX = cx + (b.atLow - torn.base) * scale;
                const highX = cx + (b.atHigh - torn.base) * scale;
                return (
                  <g key={b.key}>
                    <text x={225} y={y + 15} textAnchor="end" fill={CHART.mute} fontSize={12}>{tm(`levers.${b.key}`)}</text>
                    <rect x={Math.min(lowX, cx)} y={y} width={Math.abs(lowX - cx)} height={22} fill={lowX < cx ? CHART.clay : CHART.olive} rx={2} />
                    <rect x={Math.min(highX, cx)} y={y} width={Math.abs(highX - cx)} height={22} fill={highX < cx ? CHART.clay : CHART.olive} rx={2} />
                    <text x={Math.min(lowX, highX) - 6} y={y + 15} textAnchor="end" fill={CHART.cream} fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>{money(Math.min(b.atLow, b.atHigh))}</text>
                    <text x={Math.max(lowX, highX) + 6} y={y + 15} fill={CHART.cream} fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>{money(Math.max(b.atLow, b.atHigh))}</text>
                  </g>
                );
              })}
              <line x1={540} y1={4} x2={540} y2={12 + torn.bars.length * 34} stroke={CHART.cream} strokeWidth={1} strokeDasharray="3 3" />
            </svg>
          }
          table={
            <table className="w-full border-collapse text-[0.85rem]">
              <thead><tr className="border-b border-oh-stone text-oh-mute"><th className="py-1.5 text-left font-normal">{t("tornado.lever")}</th><th className="py-1.5 text-right font-normal">{t("tornado.low")}</th><th className="py-1.5 text-right font-normal">{t("tornado.high")}</th><th className="py-1.5 text-right font-normal">{t("tornado.swing")}</th></tr></thead>
              <tbody>{torn.bars.map((b) => (<tr key={b.key} className="border-b border-oh-stone text-oh-cream"><td className="py-1.5 text-oh-mute">{tm(`levers.${b.key}`)}</td><td className="py-1.5 text-right tabular-nums">{full(b.atLow)}</td><td className="py-1.5 text-right tabular-nums">{full(b.atHigh)}</td><td className="py-1.5 text-right tabular-nums">{full(b.swing)}</td></tr>))}</tbody>
            </table>
          }
        />
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("grid.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("grid.subtitle")}</p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[0.72rem]" role="grid" aria-label={t("grid.title")}>
            <thead>
              <tr>
                <th className="p-1 text-right font-normal text-oh-mute">{t("grid.priceAxis")}</th>
                {utilValues.map((u) => (<th key={u} className="p-1 text-center font-normal tabular-nums text-oh-mute">{fmtPercent(u, locale, 0)}</th>))}
              </tr>
            </thead>
            <tbody>
              {[...grid.cells].map((row, ri) => (
                <tr key={ri}>
                  <th scope="row" className="p-1 text-right font-normal tabular-nums text-oh-mute">{fmtCurrency(priceValues[grid.cells.length - 1 - ri] ?? 0, { locale, fractionDigits: 2 })}</th>
                  {(grid.cells[grid.cells.length - 1 - ri] ?? []).map((v, ci) => {
                    const rowIdx = grid.cells.length - 1 - ri;
                    const neighborNeg = [grid.cells[rowIdx]?.[ci - 1], grid.cells[rowIdx]?.[ci + 1], grid.cells[rowIdx - 1]?.[ci], grid.cells[rowIdx + 1]?.[ci]].some((n) => n !== undefined && Math.sign(n) !== Math.sign(v));
                    const isBase = Math.abs((utilValues[ci] ?? 0) - a.utilizationRate) < 0.001 && Math.abs((priceValues[rowIdx] ?? 0) - a.avgBowlPrice) < 0.001;
                    return (
                      <td key={ci} title={`${fmtPercent(utilValues[ci] ?? 0, locale, 0)} × ${fmtCurrency(priceValues[rowIdx] ?? 0, { locale, fractionDigits: 2 })}: ${full(v)}`} className={["h-9 min-w-[3.6rem] p-0.5 text-center tabular-nums", neighborNeg ? "outline outline-1 outline-oh-gold" : "", isBase ? "ring-2 ring-oh-cream ring-inset" : ""].join(" ")} style={{ background: cellColor(v), color: v < 0 ? CHART.cream : CHART.cream }}>
                        {money(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("grid.legend")}</p>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("mc.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("mc.subtitle", { runs: MC_RUNS.toLocaleString(locale) })}</p>
        {mc ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {[["p10", mc.p10], ["p50", mc.p50], ["p90", mc.p90]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-3"><p className="m-0 text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t(`mc.${k as string}`)}</p><p className="m-0 mt-1 font-display text-[1.5rem] leading-none tabular-nums text-oh-cream">{money(v as number)}</p></div>
              ))}
              <div className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-3"><p className="m-0 text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t("mc.belowTarget")}</p><p className="m-0 mt-1 font-display text-[1.5rem] leading-none tabular-nums text-oh-cream">{fmtPercent(mc.probabilityBelow, locale, 1)}</p><p className="m-0 mt-1 text-[0.7rem] text-oh-mute">{t("mc.belowTargetSub", { value: money(mc.threshold) })}</p></div>
            </div>
            <div className="mt-4" style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={mc.bins.map(([from, count]) => ({ from, count }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={1}>
                  <XAxis dataKey="from" tickFormatter={(v: number) => money(v)} tick={{ fill: CHART.mute, fontSize: 10 }} axisLine={{ stroke: CHART.stone }} tickLine={false} interval={7} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: CHART.ink, border: `1px solid ${CHART.stone}`, borderRadius: 6, color: CHART.cream, fontSize: 12 }} labelFormatter={(l) => money(Number(l))} formatter={(v) => [String(v), t("mc.runsLabel")]} cursor={{ fill: "rgba(242,237,228,0.04)" }} />
                  <ReferenceLine x={mc.bins.reduce((best, b) => (Math.abs(b[0] - mc.threshold) < Math.abs(best - mc.threshold) ? b[0] : best), mc.bins[0]?.[0] ?? 0)} stroke={CHART.gold} strokeDasharray="3 3" />
                  <Bar dataKey="count" fill={CHART.ember} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="m-0 text-[0.85rem] text-oh-mute">{mcState === "unavailable" ? t("mc.unavailable") : t("mc.running")}</p>
        )}
        <p className="m-0 mt-2 text-[0.75rem] text-oh-mute">{t("mc.note")}</p>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("downsides.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("downsides.subtitle")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {downsides.map((d) => (
            <div key={d.key} className="rounded-lg border border-oh-stone bg-oh-ink p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 font-display text-[1.1rem] text-oh-cream">{t(`downsides.items.${d.key}.title`)}</h3>
                <span className="shrink-0 font-display tabular-nums text-[1.1rem] text-oh-ember-light">{money(d.headline)}</span>
              </div>
              <p className="m-0 mt-1 text-[0.72rem] text-oh-mute">{d.headlineIsY1 ? t("downsides.impactY1", { margin: fmtPercent(d.marginAfter, locale, 1) }) : t("downsides.impact", { margin: fmtPercent(d.marginAfter, locale, 1), y1: money(d.y1Delta) })}</p>
              <p className="m-0 mt-3 text-[0.82rem] leading-relaxed text-oh-mute"><span className="text-oh-gold">{t("downsides.mitigation")} </span>{t(`downsides.items.${d.key}.mitigation`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
