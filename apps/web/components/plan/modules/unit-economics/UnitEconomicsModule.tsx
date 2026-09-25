"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BASE, FRANCHISE_MARKETS, NO_DEBT, SUBSEQUENT_UNIT_OVERRIDES, computeCapex, computeUnit, fmtCompact, fmtCurrency, fmtInteger, fmtPercent, fmtYears, type LocationAssumptions } from "@oh/plan-model";
import { AssumptionSlider } from "@/components/plan/controls/AssumptionSlider";
import { MARKET_PINS } from "@/components/plan/modules/expansion/markets";

interface MarketPreset {
  key: string;
  rent: number;
  nnn: number;
  utilization: number;
  bowl: number;
  wage: number;
  flagship: boolean;
}

/** Starting points per market. Rent and NNN are asking-rate assumptions for the target trade area; utilization and price scale with the market's AUV index. */
const PRESETS: readonly MarketPreset[] = [
  { key: "lehi", rent: 34, nnn: 9, utilization: 0.3, bowl: 19.5, wage: 24, flagship: true },
  { key: "slc", rent: 42, nnn: 11, utilization: 0.32, bowl: 20.0, wage: 24, flagship: false },
  { key: "south-jordan", rent: 32, nnn: 8, utilization: 0.28, bowl: 19.5, wage: 23.5, flagship: false },
  { key: "provo", rent: 30, nnn: 8, utilization: 0.3, bowl: 18.5, wage: 23, flagship: false },
  { key: "st-george", rent: 28, nnn: 7, utilization: 0.26, bowl: 19.0, wage: 22.5, flagship: false },
  { key: "nyc", rent: 120, nnn: 25, utilization: 0.4, bowl: 22.5, wage: 27, flagship: false },
  { key: "la", rent: 72, nnn: 18, utilization: 0.4, bowl: 22.0, wage: 26, flagship: false },
  { key: "las-vegas", rent: 60, nnn: 15, utilization: 0.36, bowl: 21.5, wage: 24, flagship: false },
  { key: "seattle", rent: 65, nnn: 16, utilization: 0.36, bowl: 22.0, wage: 26, flagship: false },
];

/**
 * Unit Economics Builder (spec 6.4): pick a market, adjust rent, price,
 * utilization and footprint, read the pro forma. Lets a landlord model
 * their own space and an investor stress a market they know.
 */
export function UnitEconomicsModule() {
  const t = useTranslations("plan.unitEconomics");
  const tm = useTranslations("plan.model");
  const tx = useTranslations("plan.expansion.markets");
  const locale = useLocale();
  const [marketKey, setMarketKey] = useState("lehi");
  const preset = PRESETS.find((p) => p.key === marketKey) ?? (PRESETS[0] as MarketPreset);
  const [overrides, setOverrides] = useState<Partial<LocationAssumptions>>({});

  const assumptions: LocationAssumptions = useMemo(
    () => ({ ...BASE.assumptions, rentPerSqFtAnnual: preset.rent, nnnPerSqFtAnnual: preset.nnn, utilizationRate: preset.utilization, avgBowlPrice: preset.bowl, avgKitchenWage: preset.wage, ...overrides }),
    [preset, overrides],
  );
  const unit = useMemo(() => computeUnit(BASE, { loan: NO_DEBT, assumptions, flagship: preset.flagship }), [assumptions, preset.flagship]);
  const franchise = FRANCHISE_MARKETS.find((m) => m.key === marketKey);
  const loc = unit.location;
  const money = (v: number) => fmtCurrency(v, { locale });
  const set = (k: keyof LocationAssumptions) => (v: number) => setOverrides((o) => ({ ...o, [k]: v }));
  const pick = (k: string): void => {
    setMarketKey(k);
    setOverrides({});
  };

  const lines: { key: string; value: number; pct?: number; strong?: boolean }[] = [
    { key: "revenue", value: loc.annualRevenue, strong: true },
    { key: "cogs", value: -(loc.foodCost + loc.packaging), pct: (loc.foodCost + loc.packaging) / loc.annualRevenue },
    { key: "grossProfit", value: loc.grossProfit, pct: loc.grossMarginPct, strong: true },
    { key: "labor", value: -loc.labor, pct: loc.laborPct },
    { key: "occupancy", value: -loc.occupancy, pct: loc.occupancy / loc.annualRevenue },
    { key: "otherOpex", value: -(loc.totalOpex - loc.labor - loc.occupancy), pct: (loc.totalOpex - loc.labor - loc.occupancy) / loc.annualRevenue },
    { key: "ebitda", value: loc.ebitda, pct: loc.ebitdaMarginPct, strong: true },
  ];

  return (
    <div data-plan-module="unit-economics">
      <div className="mb-6">
        <p className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("pickMarket")}</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => pick(p.key)} aria-pressed={p.key === marketKey} className={["rounded-full border px-3 py-1 text-[0.8rem]", p.key === marketKey ? "border-oh-ember bg-oh-ink text-oh-cream" : "border-oh-stone text-oh-mute hover:text-oh-cream"].join(" ")}>
              {tx(`${p.key}.name`)}
            </button>
          ))}
        </div>
        <p className="m-0 mt-2 text-[0.8rem] text-oh-mute">
          {franchise ? t("structureFranchise", { fee: fmtCompact(franchise.territoryFee, { locale }) }) : t("structureCorporate")}
          {" "}
          {(() => { const pin = MARKET_PINS.find((p) => p.key === marketKey); return pin ? t("tradeArea", { value: fmtCompact(pin.tradeArea, { locale }).replace(/^\$/, "") }) : ""; })()}
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(260px,320px)_1fr]">
        <aside className="self-start rounded-lg border border-oh-stone bg-oh-ink p-4 md:sticky md:top-32">
          <h2 className="m-0 mb-1 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("yourSpace")}</h2>
          <AssumptionSlider lever="rentPerSqFtAnnual" label={tm("levers.rentPerSqFtAnnual")} value={assumptions.rentPerSqFtAnnual} baseline={preset.rent} display={money(assumptions.rentPerSqFtAnnual)} onChange={set("rentPerSqFtAnnual")} min={15} max={150} step={1} />
          <AssumptionSlider lever="nnnPerSqFtAnnual" label={t("levers.nnn")} value={assumptions.nnnPerSqFtAnnual} baseline={preset.nnn} display={money(assumptions.nnnPerSqFtAnnual)} onChange={set("nnnPerSqFtAnnual")} min={0} max={40} step={1} />
          <AssumptionSlider lever="squareFeet" label={t("levers.squareFeet")} value={assumptions.squareFeet} baseline={BASE.assumptions.squareFeet} display={t("sqft", { value: fmtInteger(assumptions.squareFeet, locale) })} onChange={set("squareFeet")} min={2500} max={5000} step={50} />
          <AssumptionSlider lever="tenantImprovementAllowancePerSqFt" label={t("levers.ti")} value={assumptions.tenantImprovementAllowancePerSqFt} baseline={BASE.assumptions.tenantImprovementAllowancePerSqFt} display={money(assumptions.tenantImprovementAllowancePerSqFt)} onChange={set("tenantImprovementAllowancePerSqFt")} min={0} max={120} step={5} />
          <AssumptionSlider lever="pods" label={tm("levers.pods")} value={assumptions.pods} baseline={BASE.assumptions.pods} display={fmtInteger(assumptions.pods, locale)} onChange={set("pods")} min={40} max={110} step={1} />
          <AssumptionSlider lever="utilizationRate" label={tm("levers.utilizationRate")} value={assumptions.utilizationRate} baseline={preset.utilization} display={fmtPercent(assumptions.utilizationRate, locale, 0)} onChange={set("utilizationRate")} min={0.1} max={0.6} step={0.01} />
          <AssumptionSlider lever="avgBowlPrice" label={tm("levers.avgBowlPrice")} value={assumptions.avgBowlPrice} baseline={preset.bowl} display={fmtCurrency(assumptions.avgBowlPrice, { locale, fractionDigits: 2 })} onChange={set("avgBowlPrice")} min={14} max={30} step={0.25} />
          <AssumptionSlider lever="avgKitchenWage" label={t("levers.wage")} value={assumptions.avgKitchenWage} baseline={preset.wage} display={fmtCurrency(assumptions.avgKitchenWage, { locale, fractionDigits: 2 })} onChange={set("avgKitchenWage")} min={15} max={40} step={0.5} />
          <button type="button" onClick={() => setOverrides({})} className="mt-3 rounded-md border border-oh-stone bg-transparent px-3 py-1.5 text-[0.8rem] text-oh-mute hover:text-oh-cream">{t("resetMarket")}</button>
        </aside>

        <div>
          <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["revenue", fmtCompact(loc.annualRevenue, { locale }), true],
              ["ebitda", `${fmtCompact(loc.ebitda, { locale })} · ${fmtPercent(loc.ebitdaMarginPct, locale, 1)}`, false],
              ["capex", fmtCompact(unit.capex.total, { locale }), false],
              ["payback", fmtYears(unit.ramp.payback.fromOpening, locale), false],
            ].map(([k, v, accent]) => (
              <div key={k as string} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-3">
                <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{t(`results.${k as string}`)}</dt>
                <dd className={["m-0 mt-1 font-display text-[1.4rem] leading-none tabular-nums", accent ? "text-oh-ember" : "text-oh-cream"].join(" ")}>{v as string}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 mt-3 text-[0.8rem] text-oh-mute">{t("occupancyNote", { pct: fmtPercent(loc.occupancy / loc.annualRevenue, locale, 1), perSqFt: money(loc.revenuePerSqFt), covers: fmtInteger(loc.actualCoversPerDay, locale) })}</p>

          <h2 className="m-0 mb-2 mt-8 font-display text-[1.3rem] text-oh-cream">{t("proForma")}</h2>
          <table className="w-full border-collapse text-[0.88rem]">
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className={["border-b border-oh-stone", l.strong ? "font-semibold text-oh-cream" : "text-oh-cream"].join(" ")}>
                  <th scope="row" className={["py-2 text-left", l.strong ? "font-semibold" : "font-normal text-oh-mute"].join(" ")}>{t(`lines.${l.key}`)}</th>
                  <td className="py-2 text-right tabular-nums">{money(l.value)}</td>
                  <td className="w-16 py-2 text-right tabular-nums text-oh-mute">{l.pct !== undefined ? fmtPercent(l.pct, locale, 1) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="m-0 mb-2 mt-8 font-display text-[1.3rem] text-oh-cream">{t("capexTitle")}</h2>
          <table className="w-full border-collapse text-[0.85rem]">
            <tbody>
              {unit.capex.lines.map((l) => (
                <tr key={l.key} className="border-b border-oh-stone text-oh-cream">
                  <th scope="row" className="py-1.5 text-left font-normal text-oh-mute">{t(`capexLines.${l.key}`)}</th>
                  <td className="py-1.5 text-right tabular-nums">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-oh-cream"><th scope="row" className="py-2 text-left">{t("capexTotal")}</th><td className="py-2 text-right tabular-nums">{money(unit.capex.total)}</td></tr>
            </tbody>
          </table>
          <p className="m-0 mt-2 text-[0.75rem] text-oh-ash">{preset.flagship ? t("capexFlagshipNote") : t("capexSubsequentNote", { savings: money(computeCapex(BASE.assumptions).total - computeCapex(BASE.assumptions, SUBSEQUENT_UNIT_OVERRIDES).total) })}</p>
        </div>
      </div>
    </div>
  );
}
