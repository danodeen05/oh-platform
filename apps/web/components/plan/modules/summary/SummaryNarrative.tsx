import { getTranslations } from "next-intl/server";
import {
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  MATURITY_EBITDA_TARGET,
  NO_DEBT,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  PUBLIC_EBITDA_TARGET,
  SCENARIOS,
  computeCompany,
  computeOwnership,
  computeUnit,
  fmtCompact,
  fmtCurrency,
  fmtInteger,
  fmtMultiple,
  fmtPercent,
  fmtYears,
  type ScenarioKey,
} from "@oh/plan-model";
import { getSection, sectionHref, visibleSections, type SectionKey } from "@/lib/plan/sections";
import { getPlanSession } from "@/lib/plan/session.server";
import { registryHref } from "@/components/plan/primitives/SourceNotes";
import { givingFigures } from "@/components/plan/modules/foundation/giving";

/**
 * Executive narrative and diligence map for the Summary (Workstream 5,
 * item 5). Five short paragraphs, every figure interpolated from the engine
 * for the scenario the reader chose, then a table that maps the questions a
 * diligence team asks to the section that answers them and the register rows
 * behind the answer. Async server component: the gated page and the print
 * route both render it.
 */

interface MapRow {
  key: string;
  section: SectionKey;
  registry: readonly string[];
}

/** Questions in the order an equity investor usually asks them. Keys index plan.summary.narrative.map.rows. */
export const DILIGENCE_MAP: readonly MapRow[] = [
  { key: "demand", section: "market", registry: ["unit.utilizationRate", "unit.operatingDaysPerYear"] },
  { key: "check", section: "unit-economics", registry: ["menu.classicPrice", "menu.wagyuPrice", "menu.addOnAttachRate"] },
  { key: "beef", section: "unit-economics", registry: ["menu.wagyuCostPerLb", "menu.primeCostPerLb", "unit.foodCostPct"] },
  { key: "labor", section: "operations", registry: ["unit.kitchenHoursPerDay", "unit.avgKitchenWage", "unit.payrollBurdenPct"] },
  { key: "members", section: "operations", registry: ["unit.memberProgramPct", "unit.memberSwagAnnual"] },
  { key: "giving", section: "experience", registry: ["unit.communityGivingPct"] },
  { key: "overhead", section: "financials", registry: [] },
  { key: "cash", section: "financials", registry: ["unit.preOpeningMonths", "unit.maintenanceCapexPct"] },
  { key: "downside", section: "sensitivity", registry: [] },
  { key: "franchise", section: "expansion", registry: ["franchise.royaltyPct", "franchise.unitFranchiseFee"] },
  { key: "ownership", section: "funding", registry: ["partnership.partnerPctCap", "partnership.preferredReturnPct", "partnership.targetMultiple"] },
  { key: "sources", section: "integrity", registry: [] },
];

interface Props {
  locale: string;
  scenario: ScenarioKey;
  /** Print renders links as plain text. */
  print?: boolean;
}

export async function SummaryNarrative({ locale, scenario, print = false }: Props) {
  // Rows pointing at sections this code may not see are dropped, never shown as dead links.
  const claims = await getPlanSession();
  const visible: readonly SectionKey[] = claims ? visibleSections(claims).map((s) => s.key) : [];
  const t = await getTranslations("plan.summary.narrative");
  const ts = await getTranslations("plan.sections");
  const sc = SCENARIOS[scenario];
  const unit = computeUnit(sc, { loan: NO_DEBT });
  const loc = unit.location;
  const inputs = { scenario: sc, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };
  const company = computeCompany(inputs);
  const y5 = company.years[company.years.length - 1]!;
  const own5 = computeOwnership({ ...inputs, terms: PARTNERSHIP_TERMS });
  const own7 = computeOwnership({ ...inputs, terms: PARTNERSHIP_TERMS }, { exitYear: 7, hybrid: true });
  const pct = (v: number, d = 1) => fmtPercent(v, locale, d);
  const money = (v: number) => fmtCompact(v, { locale });

  const giving = givingFigures(scenario);
  const values = {
    scenario: t(`scenario.${scenario}`),
    pods: fmtInteger(sc.assumptions.pods, locale),
    sqft: fmtInteger(sc.assumptions.squareFeet, locale),
    days: fmtInteger(sc.assumptions.operatingDaysPerYear, locale),
    revenue: money(loc.annualRevenue),
    check: fmtCurrency(loc.avgCheck, { locale, fractionDigits: 2 }),
    covers: fmtInteger(Math.round(loc.actualCoversPerDay), locale),
    food: pct(loc.foodCost / loc.annualRevenue),
    labor: pct(loc.laborPct),
    ebitda: pct(loc.ebitdaMarginPct),
    target: pct(PUBLIC_EBITDA_TARGET, 0),
    stretch: pct(MATURITY_EBITDA_TARGET, 0),
    breakEven: fmtInteger(Math.round(loc.breakEvenCoversPerDay), locale),
    capex: money(unit.capex.total),
    payback: fmtYears(unit.ramp.payback.fromOpening ?? null, locale),
    corporate: fmtInteger(y5.corporateLocations, locale),
    franchise: fmtInteger(y5.franchiseLocations, locale),
    y5Revenue: money(y5.companyRevenue),
    overhead: money(y5.corporateOverhead),
    consolidated: money(y5.consolidatedEbitda),
    cashLine: company.minimumCash >= 0 ? t("cash.positive", { amount: money(company.minimumCash) }) : t("cash.negative", { amount: money(-company.minimumCash) }),
    capital: money(own5.totalCapital),
    partner: pct(own5.preferred.partnerCommonPct, 0),
    multiple5: fmtMultiple(own5.preferred.partnerMultiple, locale),
    multiple7: fmtMultiple(own7.preferred.partnerMultiple, locale),
    pref: pct(own5.preferred.preferredReturnPct, 0),
    liq: fmtMultiple(own5.preferred.liquidationPreference, locale, 0),
    fte: fmtInteger(Math.round(sc.assumptions.kitchenFTE + sc.assumptions.managerFTE), locale),
    givingPct: pct(giving.pct, 0),
    givingPerUnit: money(giving.perUnit),
    givingFiveYear: money(giving.fiveYear),
  };

  const rows = DILIGENCE_MAP.filter((r) => visible.includes(r.section));
  const linkClass = "underline decoration-oh-stone underline-offset-4 hover:text-oh-cream";
  // Dark site vs white print page: same structure, print-safe colors.
  const c = print
    ? { eyebrow: "text-oh-clay", title: "text-oh-charcoal", body: "text-oh-charcoal", strong: "text-oh-charcoal", mute: "text-oh-stone", border: "border-oh-charcoal/15", head: "bg-transparent text-oh-clay", cell: "text-oh-charcoal" }
    : { eyebrow: "text-oh-ember", title: "text-oh-cream", body: "text-oh-cream/90", strong: "text-oh-cream", mute: "text-oh-mute", border: "border-oh-stone", head: "bg-oh-ink text-oh-mute", cell: "text-oh-cream" };

  return (
    <section aria-labelledby="summary-narrative" className="mt-12">
      <p className={`m-0 text-[0.72rem] uppercase tracking-[0.18em] ${c.eyebrow}`}>{t("eyebrow", values)}</p>
      <h2 id="summary-narrative" className={`m-0 mt-2 font-display text-[1.9rem] font-normal leading-tight [text-wrap:balance] ${c.title}`}>
        {t("title")}
      </h2>
      <div className={`mt-5 flex max-w-[68ch] flex-col gap-4 text-[1rem] leading-relaxed ${c.body}`}>
        {(["thesis", "purpose", "unit", "growth", "ask", "risks"] as const).map((k) => (
          <p key={k} className="m-0">
            <span className={`font-semibold ${c.strong}`}>{t(`lead.${k}`)}</span> {t(`body.${k}`, values)}
          </p>
        ))}
      </div>

      <h3 className={`m-0 mt-12 font-display text-[1.4rem] font-normal ${c.title}`}>{t("map.title")}</h3>
      <p className={`m-0 mt-2 max-w-[68ch] text-[0.9rem] leading-relaxed ${c.mute}`}>{t("map.intro")}</p>
      <div className={`mt-4 overflow-x-auto rounded-lg border ${c.border}`}>
        <table className={`w-full border-collapse text-left text-[0.85rem] ${print ? "" : "min-w-[40rem]"}`}>
          <thead className={`text-[0.68rem] uppercase tracking-[0.14em] ${c.head}`}>
            <tr>
              <th scope="col" className="px-4 py-3 font-normal">{t("map.headers.question")}</th>
              <th scope="col" className="px-4 py-3 font-normal">{t("map.headers.where")}</th>
              <th scope="col" className="px-4 py-3 font-normal">{t("map.headers.evidence")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = getSection(r.section);
              const title = ts(`${s.titleKey}.title`);
              return (
                <tr key={r.key} className={`border-t align-top ${c.border}`}>
                  <th scope="row" className={`px-4 py-3 font-normal ${c.cell}`}>{t(`map.rows.${r.key}`, values)}</th>
                  <td className={`px-4 py-3 ${c.mute}`}>
                    {print ? title : <a href={sectionHref(locale, s)} className={linkClass}>{title}</a>}
                  </td>
                  <td className={`px-4 py-3 ${c.mute}`}>
                    {r.registry.length === 0 || !visible.includes("integrity") ? (
                      <span>{t("map.inSection")}</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {r.registry.map((k) =>
                          print ? (
                            <span key={k} className="font-mono text-[0.75rem]">{k}</span>
                          ) : (
                            <a key={k} href={registryHref(locale, k)} className={`${linkClass} font-mono text-[0.75rem]`}>{k}</a>
                          ),
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
