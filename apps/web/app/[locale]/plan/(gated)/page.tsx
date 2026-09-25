import { getTranslations } from "next-intl/server";
import { BASE, FRANCHISE_MARKETS, FRANCHISE_TERMS, NO_DEBT, OPENING_SCHEDULE, PARTNERSHIP_TERMS, computeOwnership, computeUnit } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { StatCard } from "@/components/plan/primitives/StatCard";
import { BenchmarkCallout } from "@/components/plan/primitives/BenchmarkCallout";
import { Placeholder } from "@/components/plan/shell/Placeholder";

/**
 * Executive summary. Phase 3 shows the headline figures straight from the
 * engine so the shell has real numbers to frame; the narrative arrives in 4d.
 * Headline EBITDA target is held at 25% per spec 5.5; the model page shows
 * the full engine margin. No debt in the base case: a single financial
 * partner funds both rounds, and the partner's stake is derived, not asserted.
 */
export default async function PlanSummaryPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireSection("summary");
  const { locale } = await params;
  const t = await getTranslations("plan.summary");
  const unit = computeUnit(BASE, { loan: NO_DEBT });
  const ownership = computeOwnership({ scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });

  return (
    <SectionFrame sectionKey="summary">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("revenue")} value={unit.location.annualRevenue} kind="compact" locale={locale} accent note={t("revenueNote")} />
        <StatCard label={t("revPerSqFt")} value={unit.location.revenuePerSqFt} kind="currency" locale={locale} note={t("revPerSqFtNote")} />
        <StatCard label={t("ebitdaTarget")} value={0.25} kind="percent" locale={locale} fractionDigits={0} note={t("ebitdaTargetNote")} />
        <StatCard label={t("capital")} value={ownership.totalCapital} kind="compact" locale={locale} note={t("capitalNote")} />
        <StatCard label={t("partner")} value={ownership.partnerPct} kind="percent" locale={locale} fractionDigits={0} note={t("partnerNote")} />
        <StatCard label={t("payback")} value={unit.ramp.payback.fromOpening ?? 0} kind="years" locale={locale} note={t("paybackNote")} />
      </div>
      <BenchmarkCallout eyebrow={t("benchmarkEyebrow")} claim={t("benchmarkClaim")} benchmark={t("benchmarkText")} />
      <Placeholder text={t("placeholder")} />
    </SectionFrame>
  );
}
