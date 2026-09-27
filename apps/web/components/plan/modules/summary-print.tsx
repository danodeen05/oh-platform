import { getFormatter, getTranslations } from "next-intl/server";
import { FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, PARTNERSHIP_TERMS, PUBLIC_EBITDA_TARGET, SCENARIOS, computeLocation, computeOwnership, computeUnit, fmtYears, tornado, type ScenarioKey } from "@oh/plan-model";
import { RISK_REGISTER, computeDownsides, tornadoRanges } from "./sensitivity/downsides";
import { SummaryNarrative } from "./summary/SummaryNarrative";
import { VisionStatement } from "./summary/VisionStatement";

interface PrintProps {
  locale: string;
  /** Scenario from the header switch; the print route defaults to base. */
  scenario?: ScenarioKey;
}

export async function SummaryPrint({ locale, scenario = "base" }: PrintProps) {
  const t = await getTranslations("plan.summary");
  const tn = await getTranslations("plan.summary.narrative");
  const fmt = await getFormatter();
  const S = SCENARIOS[scenario];
  const unit = computeUnit(S, { loan: NO_DEBT });
  const own = computeOwnership({ scenario: S, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
  const rows: [string, string, string][] = [
    [t("revenue", { scenario: tn(`scenario.${scenario}`) }), fmt.number(unit.location.annualRevenue, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("revenueNote")],
    [t("revPerSqFt"), fmt.number(unit.location.revenuePerSqFt, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("revPerSqFtNote")],
    [t("ebitdaTarget"), fmt.number(PUBLIC_EBITDA_TARGET, { style: "percent" }), t("ebitdaTargetNote")],
    [t("capital"), fmt.number(own.totalCapital, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), t("capitalNote")],
    [t("partner"), fmt.number(own.partnerPct, { style: "percent" }), t("partnerNote")],
    [t("payback"), fmt.number(unit.ramp.payback.fromOpening ?? 0, { maximumFractionDigits: 1 }), t("paybackNote")],
  ];
  return (
    <div className="mt-6 text-[0.9rem] text-oh-charcoal">
      <VisionStatement tone="light" className="mb-6" id="plan-vision-print" />
      <table className="w-full border-collapse"><tbody>{rows.map(([k, v, n]) => (<tr key={k} className="border-b border-oh-charcoal/10"><td className="py-2 text-[0.75rem] uppercase tracking-[0.12em] text-oh-clay">{k}</td><td className="py-2 text-right font-display text-[1.2rem] tabular-nums">{v}</td><td className="py-2 pl-4 text-[0.8rem] text-oh-stone">{n}</td></tr>))}</tbody></table>
      <p className="m-0 mt-4 leading-relaxed"><span className="font-display text-[1.05rem]">{t("benchmarkClaim")}</span> <span className="text-oh-stone">{t("benchmarkText")}</span></p>
      <div className="plan-print-narrative">
        <SummaryNarrative locale={locale} scenario={scenario} print />
      </div>
    </div>
  );
}

export async function UnitEconomicsPrint(_props: PrintProps) {
  const t = await getTranslations("plan.unitEconomics");
  const tm = await getTranslations("plan.model");
  const fmt = await getFormatter();
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (v: number) => fmt.number(v, { style: "percent", maximumFractionDigits: 1 });
  const units = (["conservative", "base", "aggressive"] as const).map((k) => computeLocation(SCENARIOS[k].assumptions));
  const lines: [string, (l: (typeof units)[number]) => number][] = [
    [t("lines.revenue"), (l) => l.annualRevenue],
    [t("lines.cogs"), (l) => -(l.foodCost + l.packaging)],
    [t("lines.memberProgram"), (l) => -l.memberProgram],
    [t("lines.discountsComps"), (l) => -l.discountsComps],
    [t("lines.grossProfit"), (l) => l.grossProfit],
    [t("lines.labor"), (l) => -l.labor],
    [t("lines.occupancy"), (l) => -l.occupancy],
    [t("lines.otherOpex"), (l) => -(l.totalOpex - l.labor - l.occupancy - l.communityGiving)],
    [t("lines.communityGiving"), (l) => -l.communityGiving],
    [t("lines.ebitda"), (l) => l.ebitda],
  ];
  return (
    <table className="mt-6 w-full border-collapse text-[0.85rem] text-oh-charcoal">
      <thead><tr className="border-b border-oh-charcoal/30 text-oh-clay"><th className="py-1.5 text-left font-normal">{t("proForma")}</th>{(["conservative", "base", "aggressive"] as const).map((k) => (<th key={k} className="py-1.5 text-right font-normal">{tm(`scenario.${k}`)}</th>))}</tr></thead>
      <tbody>{lines.map(([label, f]) => (<tr key={label} className="border-b border-oh-charcoal/10"><td className="py-1.5">{label}</td>{units.map((u, i) => (<td key={i} className="py-1.5 text-right tabular-nums">{money(f(u))}</td>))}</tr>))}<tr><td className="py-1.5 text-oh-clay">{tm("results.margin")}</td>{units.map((u, i) => (<td key={i} className="py-1.5 text-right tabular-nums">{pct(u.ebitdaMarginPct)}</td>))}</tr></tbody>
    </table>
  );
}

export async function SensitivityPrint({ scenario = "base" }: PrintProps) {
  const t = await getTranslations("plan.sensitivity");
  const tm = await getTranslations("plan.model");
  const fmt = await getFormatter();
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const S = SCENARIOS[scenario];
  const a = S.assumptions;
  const torn = tornado(a, tornadoRanges(a));
  const downsides = computeDownsides(S);
  const values = { people: Math.round(a.kitchenFTE + a.managerFTE), hours: Math.round(a.kitchenHoursPerDay), program: fmt.number(a.memberProgramPct, { style: "percent", maximumFractionDigits: 1 }), swag: money(a.memberSwagAnnual), launch: money(a.launchMarketing), days: a.operatingDaysPerYear, pods: a.pods };
  const headline = (d: (typeof downsides)[number]): string => (d.headline === "payback" ? t("downsides.paybackDelta", { years: Number.isNaN(d.value) ? "n/a" : fmtYears(d.value, "en-US") }) : money(d.value));
  return (
    <div className="mt-6 flex flex-col gap-6 text-[0.85rem] text-oh-charcoal">
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem]">{t("tornado.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30 text-oh-clay"><th className="py-1.5 text-left font-normal">{t("tornado.lever")}</th><th className="py-1.5 text-right font-normal">{t("tornado.low")}</th><th className="py-1.5 text-right font-normal">{t("tornado.high")}</th><th className="py-1.5 text-right font-normal">{t("tornado.swing")}</th></tr></thead>
        <tbody>{torn.bars.map((b) => (<tr key={b.key} className="border-b border-oh-charcoal/10"><td className="py-1.5">{tm(`levers.${b.key}`)}</td><td className="py-1.5 text-right tabular-nums">{money(b.atLow)}</td><td className="py-1.5 text-right tabular-nums">{money(b.atHigh)}</td><td className="py-1.5 text-right tabular-nums">{money(b.swing)}</td></tr>))}</tbody>
      </table>
      <div>
        <p className="m-0 mb-2 font-display text-[1.1rem]">{t("downsides.title")}</p>
        {downsides.map((d) => (<p key={d.key} className="m-0 py-1 leading-relaxed"><span className="font-semibold">{t(`downsides.items.${d.key}.title`)}</span> <span className="tabular-nums text-oh-clay">{headline(d)}</span>. <span className="text-oh-stone">{t(`downsides.items.${d.key}.mitigation`, values)}</span></p>))}
      </div>
      <div>
        <p className="m-0 mb-2 font-display text-[1.1rem]">{t("register.title")}</p>
        <p className="m-0 mb-2 text-oh-stone">{t("register.subtitle")}</p>
        {RISK_REGISTER.map((k) => (<p key={k} className="m-0 py-0.5 leading-relaxed"><span className="font-semibold">{t(`register.items.${k}.title`)}.</span> <span className="text-oh-stone">{t(`register.items.${k}.body`)}</span></p>))}
      </div>
    </div>
  );
}
