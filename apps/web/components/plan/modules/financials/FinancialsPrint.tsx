import { getFormatter, getTranslations } from "next-intl/server";
import { FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, SCENARIOS, SUBSEQUENT_UNIT_OVERRIDES, computeCapex, computeCompany, computeUnit, type CompanyYear, type ScenarioKey } from "@oh/plan-model";

const COMPANY_ROWS: readonly { key: keyof CompanyYear; sign: 1 | -1; strong?: boolean }[] = [
  { key: "corporateRevenue", sign: 1 },
  { key: "unitEbitda", sign: 1, strong: true },
  { key: "preOpeningExpense", sign: -1 },
  { key: "corporateOverhead", sign: -1 },
  { key: "franchiseContribution", sign: 1 },
  { key: "platformGrossProfit", sign: 1 },
  { key: "consolidatedEbitda", sign: 1, strong: true },
  { key: "taxDistributions", sign: -1 },
  { key: "maintenanceCapex", sign: -1 },
  { key: "growthCapex", sign: -1 },
  { key: "investments", sign: -1 },
  { key: "freeCashFlow", sign: 1, strong: true },
  { key: "equityRaised", sign: 1 },
  { key: "cumulativeCash", sign: 1, strong: true },
];
const PLATFORM_ROWS = ["systemLocations", "licenseARR", "grossRoyalties", "royalties", "unitFees", "territoryFees", "franchiseSupportCost", "franchiseContribution", "platformGrossProfit", "companyRevenue", "systemWideSales"] as const;

export async function FinancialsPrint({ locale, scenario = "base" }: { locale: string; scenario?: ScenarioKey }) {
  const S = SCENARIOS[scenario];
  const t = await getTranslations("plan.financials");
  const fmt = await getFormatter();
  void locale;
  const money = (v: number) => fmt.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const company = computeCompany({ scenario: S, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS }, { years: 5 });
  const portfolio = company.portfolio;
  const unit = computeUnit(S, { loan: NO_DEBT });
  const platform = company.platform;
  const flagship = computeCapex(S.assumptions);
  const subsequent = computeCapex(S.assumptions, SUBSEQUENT_UNIT_OVERRIDES);
  const lowest = company.years.reduce((min, y) => (y.cumulativeCash < min.cumulativeCash ? y : min), company.years[0] as CompanyYear);
  const y5 = company.years[4] as CompanyYear;
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
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("company.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("company.line")}</th>{company.years.map((y) => (<th key={y.year} className={th}>{t("yearShort", { n: y.year })}</th>))}</tr></thead>
        <tbody>{COMPANY_ROWS.map((r) => (<tr key={r.key} className={["border-b border-oh-charcoal/10", r.strong ? "font-semibold" : ""].join(" ")}><td className="py-1.5 text-oh-charcoal">{t(`company.lines.${r.key}`)}</td>{company.years.map((y) => (<td key={y.year} className={td}>{money((y[r.key] as number) * r.sign)}</td>))}</tr>))}</tbody>
      </table>
      <p className="m-0 text-oh-stone">{t("company.note", { overhead: money(y5.corporateOverhead), consolidated: money(y5.consolidatedEbitda), recurring: money(y5.recurringEbitda) })} {company.minimumCash < 0 ? t("company.runwayShort", { low: money(company.minimumCash), year: lowest.year }) : t("company.runwayNote", { low: money(company.minimumCash), year: lowest.year })}</p>
      <p className="m-0 text-oh-stone">{t("ramp.note", { y1: money(unit.ramp.years[0]?.revenue ?? 0), y2: money(unit.ramp.years[1]?.revenue ?? 0) })}</p>
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("capex.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("capex.line")}</th><th className={th}>{t("capex.flagship")}</th><th className={th}>{t("capex.subsequent")}</th></tr></thead>
        <tbody>{flagship.lines.map((l, i) => (<tr key={l.key} className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t(`capex.lines.${l.key}`)}</td><td className={td}>{money(l.amount)}</td><td className={td}>{money(subsequent.lines[i]?.amount ?? 0)}</td></tr>))}<tr className="font-semibold"><td className="py-1.5 text-oh-charcoal">{t("capex.total")}</td><td className={td}>{money(flagship.total)}</td><td className={td}>{money(subsequent.total)}</td></tr></tbody>
      </table>
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left font-display text-[1.1rem] text-oh-charcoal">{t("platform.title")}</caption>
        <thead><tr className="border-b border-oh-charcoal/30"><th className="py-1.5 text-left font-normal text-oh-clay">{t("platform.line")}</th>{platform.years.map((y) => (<th key={y.year} className={th}>{t("yearShort", { n: y.year })}</th>))}</tr></thead>
        <tbody>{PLATFORM_ROWS.map((k) => (<tr key={k} className="border-b border-oh-charcoal/10"><td className="py-1.5 text-oh-charcoal">{t(`platform.lines.${k}`)}</td>{platform.years.map((y) => (<td key={y.year} className={td}>{k === "systemLocations" ? y[k] : money(k === "franchiseSupportCost" ? -y[k] : y[k])}</td>))}</tr>))}</tbody>
      </table>
    </div>
  );
}
