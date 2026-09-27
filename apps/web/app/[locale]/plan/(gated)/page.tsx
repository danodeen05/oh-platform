import { getTranslations } from "next-intl/server";
import { FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, PARTNERSHIP_TERMS, PUBLIC_EBITDA_TARGET, SCENARIOS, computeOwnership, computeUnit, fmtCompact, fmtInteger, fmtPercent } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { StatCard, type StatWhy } from "@/components/plan/primitives/StatCard";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { SummaryNarrative } from "@/components/plan/modules/summary/SummaryNarrative";
import { VisionStatement } from "@/components/plan/modules/summary/VisionStatement";
import { PlanPhoto } from "@/components/plan/primitives/PlanPhoto";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";

/**
 * Executive summary: the headline figures for the reader's scenario, each
 * with a "why this number" disclosure that links to its register rows, then
 * the narrative and the diligence map.
 * The headline EBITDA target is the engine's public target (15%, 20% at
 * maturity, owner decision 2026-09-26); the model page shows the full margin. No debt in the base case: a single financial
 * partner funds both rounds, and the partner's stake is derived, not asserted.
 */
export default async function PlanSummaryPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireSection("summary");
  const { locale } = await params;
  const t = await getTranslations("plan.summary");
  const tp = await getTranslations("plan.photos");
  const tn = await getTranslations("plan.summary.narrative");
  const tShell = await getTranslations("plan.shell");
  const scenario = await getPlanScenario();
  const unit = computeUnit(SCENARIOS[scenario], { loan: NO_DEBT });
  const ownership = computeOwnership({ scenario: SCENARIOS[scenario], terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });

  const a = SCENARIOS[scenario].assumptions;
  const whyLabels = { open: tShell("why.open"), register: tShell("why.register") };
  const why = (key: string, registryKeys: readonly string[], values: Record<string, string> = {}): StatWhy => ({ text: t(`why.${key}`, values), registryKeys, labels: whyLabels, locale });

  return (
    <SectionFrame sectionKey="summary">
      <SectionEdge sectionKey="summary" scenario={scenario} />
      <VisionStatement className="mb-10" />
      <PlanPhoto src="/plan/summary-bowl.webp" alt={t("heroAlt")} width={1400} height={600} caption={t("heroCaption")} note={tp("concept")} className="mb-8" priority />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("revenue", { scenario: tn(`scenario.${scenario}`) })} value={unit.location.annualRevenue} kind="compact" locale={locale} accent note={t("revenueNote")} why={why("revenue", ["unit.utilizationRate", "unit.avgDwellMinutes", "menu.classicPrice", "unit.operatingDaysPerYear"], { days: fmtInteger(a.operatingDaysPerYear, locale), pods: fmtInteger(a.pods, locale) })} />
        <StatCard label={t("revPerSqFt")} value={unit.location.revenuePerSqFt} kind="currency" locale={locale} note={t("revPerSqFtNote")} why={why("revPerSqFt", ["unit.squareFeet"], { sqft: fmtInteger(a.squareFeet, locale) })} />
        <StatCard label={t("ebitdaTarget")} value={PUBLIC_EBITDA_TARGET} kind="percent" locale={locale} fractionDigits={0} note={t("ebitdaTargetNote")} why={why("ebitdaTarget", ["unit.foodCostPct", "unit.kitchenHoursPerDay", "unit.memberProgramPct"], { margin: fmtPercent(unit.location.ebitdaMarginPct, locale, 1) })} />
        <StatCard label={t("capital")} value={ownership.totalCapital} kind="compact" locale={locale} note={t("capitalNote")} why={why("capital", ["partnership.founderCapital", "partnership.partnerCapital"])} />
        <StatCard label={t("partner")} value={ownership.partnerPct} kind="percent" locale={locale} fractionDigits={0} note={t("partnerNote")} why={why("partner", ["partnership.targetMultiple", "partnership.partnerPctCap", "partnership.exitMultiple"], { cap: fmtPercent(PARTNERSHIP_TERMS.partnerPctCap, locale, 0) })} />
        <StatCard label={t("payback")} value={unit.ramp.payback.fromOpening ?? 0} kind="years" locale={locale} note={t("paybackNote")} why={why("payback", ["unit.preOpeningMonths", "unit.rampCurve", "unit.maintenanceCapexPct"], { capex: fmtCompact(unit.capex.total, { locale }) })} />
      </div>
      <BenchmarkCallout eyebrow={t("benchmarkEyebrow")} claim={t("benchmarkClaim")} benchmark={t("benchmarkText")} />
      <SummaryNarrative locale={locale} scenario={scenario} />
    </SectionFrame>
  );
}
