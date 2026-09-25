import { getFormatter, getTranslations } from "next-intl/server";
import { BASE, BASE_ASSUMPTIONS, FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, PARTNERSHIP_TERMS, SCENARIOS, computeLocation, computeOwnership, computeUnit, tornado, withLever, type LeverKey } from "@oh/plan-model";

export async function SummaryPrint() {
  const t = await getTranslations("plan.summary");
  const fmt = await getFormatter();
  const unit = computeUnit(BASE, { loan: NO_DEBT });
  const own = computeOwnership({ scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
  const rows: [string, string, string][] = [
    [t("revenue"), fmt.number(unit.location.annualRevenue, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("revenueNote")],
    [t("revPerSqFt"), fmt.number(unit.location.revenuePerSqFt, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("revPerSqFtNote")],
    [t("ebitdaTarget"), fmt.number(0.25, { style: "percent" }), t("ebitdaTargetNote")],
    [t("capital"), fmt.number(own.totalCapital, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("capitalNote")],
    [t("partner"), fmt.number(own.partnerPct, { style: "percent" }), t("partnerNote")],
    [t("payback"), fmt.number(unit.ramp.payback.fromOpening ?? 0, { maximumFractionDigits: 1 }), t("paybackNote")],
  ];
  return (
    <div className="mt-6 text-[0.9rem] text-oh-charcoal">
      <table className="w-full border-collapse"><tbody>{rows.map(([k, v, n]) => (<tr key={k} className="border-b border-oh-charcoal/10"><td className="py-2 text-[0.75rem] uppercase tracking-[0.12em] text-oh-ash">{k}</td><td className="py-2 text-right font-display text-[1.2rem] tabular-nums">{v}</td><td className="py-2 pl-4 text-[0.8rem] text-oh-stone">{n}</td></tr>))}</tbody></table>
      <p className="m-0 mt-4 leading-relaxed"><span className="font-display text-[1.05rem]">{t("benchmarkClaim")}</span> <span className="text-oh-stone">{t("benchmarkText")}</span></p>
    </div>
  );
}

export async function UnitEconomicsPrint() {
  const t = await getTranslations("plan.unitEconomics");
  const tm = await getTranslations("plan.model");
  const fmt = await getFormatter();
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (v: number) => fmt.number(v, { style: "percent", maximumFractionDigits: 1 });
  const units = (["conservative", "base", "aggressive"] as const).map((k) => computeLocation(SCENARIOS[k].assumptions));
  const lines: [string, (l: (typeof units)[number]) => number][] = [
    [t("lines.revenue"), (l) => l.annualRevenue],
    [t("lines.cogs"), (l) => -(l.foodCost + l.packaging)],
    [t("lines.grossProfit"), (l) => l.grossProfit],
    [t("lines.labor"), (l) => -l.labor],
    [t("lines.occupancy"), (l) => -l.occupancy],
    [t("lines.otherOpex"), (l) => -(l.totalOpex - l.labor - l.occupancy)],
    [t("lines.ebitda"), (l) => l.ebitda],
  ];
  return (
    <table className="mt-6 w-full border-collapse text-[0.85rem] text-oh-charcoal">
      <thead><tr className="border-b border-oh-charcoal/30 text-oh-ash"><th className="py-1.5 text-left font-normal">{t("proForma")}</th>{(["conservative", "base", "aggressive"] as const).map((k) => (<th key={k} className="py-1.5 text-right font-normal">{tm(`scenario.${k}`)}</th>))}</tr></thead>
      <tbody>{lines.map(([label, f]) => (<tr key={label} className="border-b border-oh-charcoal/10"><td className="py-1.5">{label}</td>{units.map((u, i) => (<td key={i} className="py-1.5 text-right tabular-nums">{money(f(u))}</td>))}</tr>))}<tr><td className="py-1.5 text-oh-ash">{tm("results.margin")}</td>{units.map((u, i) => (<td key={i} className="py-1.5 text-right tabular-nums">{pct(u.ebitdaMarginPct)}</td>))}</tr></tbody>
    </table>
  );
}

export async function SensitivityPrint() {
  const t = await getTranslations("plan.sensitivity");
  const tm = await getTranslations("plan.model");
  const fmt = await getFormatter();
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const a = BASE_ASSUMPTIONS;
  const torn = tornado(a, [
    { key: "utilizationRate" as LeverKey, low: a.utilizationRate * 0.8, high: a.utilizationRate * 1.2 },
    { key: "avgBowlPrice" as LeverKey, low: a.avgBowlPrice - 2, high: a.avgBowlPrice + 2 },
    { key: "foodCostPct" as LeverKey, low: a.foodCostPct + 0.03, high: a.foodCostPct - 0.03 },
    { key: "rentPerSqFtAnnual" as LeverKey, low: a.rentPerSqFtAnnual + 10, high: a.rentPerSqFtAnnual - 10 },
    { key: "kitchenFTE" as LeverKey, low: a.kitchenFTE + 2, high: a.kitchenFTE - 2 },
    { key: "avgDwellMinutes" as LeverKey, low: a.avgDwellMinutes + 5, high: a.avgDwellMinutes - 5 },
    { key: "pods" as LeverKey, low: a.pods - 10, high: a.pods + 10 },
  ]);
  const base = computeLocation(a);
  const downsides = [
    ["rentInflation", withLever(a, "rentPerSqFtAnnual", a.rentPerSqFtAnnual + 15)],
    ["beefSpike", withLever(a, "foodCostPct", a.foodCostPct + 0.05)],
    ["copycat", withLever(a, "utilizationRate", a.utilizationRate * 0.8)],
    ["podReliability", withLever(withLever(a, "repairsMaintPct", a.repairsMaintPct + 0.015), "pods", a.pods - 5)],
    ["laborShock", withLever(withLever(a, "avgKitchenWage", a.avgKitchenWage + 3), "kitchenFTE", a.kitchenFTE + 1)],
  ] as const;
  return (
    <div className="mt-6 flex flex-col gap-6 text-[0.85rem] text-oh-charcoal">
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem]">{t("tornado.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30 text-oh-ash"><th className="py-1.5 text-left font-normal">{t("tornado.lever")}</th><th className="py-1.5 text-right font-normal">{t("tornado.low")}</th><th className="py-1.5 text-right font-normal">{t("tornado.high")}</th><th className="py-1.5 text-right font-normal">{t("tornado.swing")}</th></tr></thead>
        <tbody>{torn.bars.map((b) => (<tr key={b.key} className="border-b border-oh-charcoal/10"><td className="py-1.5">{tm(`levers.${b.key}`)}</td><td className="py-1.5 text-right tabular-nums">{money(b.atLow)}</td><td className="py-1.5 text-right tabular-nums">{money(b.atHigh)}</td><td className="py-1.5 text-right tabular-nums">{money(b.swing)}</td></tr>))}</tbody>
      </table>
      <div>
        <p className="m-0 mb-2 font-display text-[1.1rem]">{t("downsides.title")}</p>
        {downsides.map(([k, stressed]) => { const loc = computeLocation(stressed); return (<p key={k} className="m-0 py-1 leading-relaxed"><span className="font-semibold">{t(`downsides.items.${k}.title`)}</span> <span className="tabular-nums text-oh-clay">{money(loc.ebitda - base.ebitda)}</span>. <span className="text-oh-stone">{t(`downsides.items.${k}.mitigation`)}</span></p>); })}
      </div>
    </div>
  );
}
