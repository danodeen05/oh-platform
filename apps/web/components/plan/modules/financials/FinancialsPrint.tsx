import { getFormatter, getTranslations } from "next-intl/server";
import { BASE, FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, SUBSEQUENT_UNIT_OVERRIDES, computeCapex, computePlatform, computePortfolio, computeUnit } from "@oh/plan-model";

export async function FinancialsPrint({ locale }: { locale: string }) {
  const t = await getTranslations("plan.financials");
  const fmt = await getFormatter();
  void locale;
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const portfolio = computePortfolio(OPENING_SCHEDULE, BASE, { years: 5 });
  const unit = computeUnit(BASE, { loan: NO_DEBT });
  const platform = computePlatform({ corporate: portfolio.years.map((y) => ({ year: y.year, corporateRevenue: y.revenue, corporateLocationsAtEnd: y.locationsOpenAtEnd })), markets: FRANCHISE_MARKETS, terms: FRANCHISE_TERMS, unitSteadyRevenue: unit.location.annualRevenue, ramp: BASE.assumptions, techPlatformPct: BASE.assumptions.techPlatformPct });
  const flagship = computeCapex(BASE.assumptions);
  const subsequent = computeCapex(BASE.assumptions, SUBSEQUENT_UNIT_OVERRIDES);
  const th = "py-1.5 text-right font-normal text-oh-clay";
  const td = "py-1.5 text-right tabular-nums text-oh-charcoal";
  return (
    <div className="mt-6 flex flex-col gap-8 text-[0.85rem]">
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("portfolio.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("portfolio.yearCol")}</th><th className={th}>{t("portfolio.locations")}</th><th className={th}>{t("portfolio.revenue")}</th><th className={th}>{t("portfolio.ebitda")}</th><th className={th}>{t("portfolio.margin")}</th><th className={th}>{t("portfolio.capex")}</th></tr></thead>
        <tbody>{portfolio.years.map((y) => (<tr key={y.year} className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t("year", { n: y.year })}</td><td className={td}>{y.locationsOpenAtEnd}</td><td className={td}>{money(y.revenue)}</td><td className={td}>{money(y.ebitda)}</td><td className={td}>{fmt.number(y.revenue > 0 ? y.ebitda / y.revenue : 0, { style: "percent", maximumFractionDigits: 1 })}</td><td className={td}>{money(y.capexDeployed)}</td></tr>))}</tbody>
      </table>
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("capex.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("capex.line")}</th><th className={th}>{t("capex.flagship")}</th><th className={th}>{t("capex.subsequent")}</th></tr></thead>
        <tbody>{flagship.lines.map((l, i) => (<tr key={l.key} className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t(`capex.lines.${l.key}`)}</td><td className={td}>{money(l.amount)}</td><td className={td}>{money(subsequent.lines[i]?.amount ?? 0)}</td></tr>))}<tr className="font-semibold"><td className="py-1.5 text-oh-charcoal">{t("capex.total")}</td><td className={td}>{money(flagship.total)}</td><td className={td}>{money(subsequent.total)}</td></tr></tbody>
      </table>
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("platform.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("platform.line")}</th>{platform.years.map((y) => (<th key={y.year} className={th}>{t("yearShort", { n: y.year })}</th>))}</tr></thead>
        <tbody>{(["systemLocations", "licenseARR", "royalties", "unitFees", "territoryFees", "platformGrossProfit", "companyRevenue", "systemWideSales"] as const).map((k) => (<tr key={k} className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t(`platform.lines.${k}`)}</td>{platform.years.map((y) => (<td key={y.year} className={td}>{k === "systemLocations" ? y[k] : money(y[k])}</td>))}</tr>))}</tbody>
      </table>
    </div>
  );
}
