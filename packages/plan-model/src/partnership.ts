import { computePlatform } from "./platform";
import { computePortfolio } from "./portfolio";
import type { FranchiseMarket, FranchiseTerms, OpeningPlan, Owner, OwnershipModel, PartnershipTerms, Scenario } from "./types";
import { computeLocation } from "./location";

export interface OwnershipInput {
  scenario: Scenario;
  terms: PartnershipTerms;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  franchiseTerms: FranchiseTerms;
}

/** Round to the nearest 5% and keep inside 0..1. */
export function roundToFivePct(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 20) / 20));
}

/**
 * Implied partner ownership for a single financial partner (owner decision
 * 2026-09-25). Two lenses, both from the engine:
 *
 * Return-based (the venture method): the partner needs partnerCapital ×
 * targetMultiple at the exit; ownership is that amount over the exit value,
 * where exit value is exit-year EBITDA (corporate units plus the platform
 * gross profit plus the franchise contribution) times the exit multiple.
 *
 * Sweat-equity benchmark: what an operator who brings the concept and runs
 * the company typically keeps when a partner funds all capital (25% to 40%).
 * The model reports whether the founder's residual sits inside that range so
 * the headline is checked against practice, not just arithmetic.
 */
export function computeOwnership(input: OwnershipInput): OwnershipModel {
  const { scenario, terms, schedule, markets, franchiseTerms } = input;
  const portfolio = computePortfolio(schedule, scenario, { years: terms.exitYear });
  const base = computeLocation(scenario.assumptions);
  const platform = computePlatform({
    corporate: portfolio.years.map((y) => ({ year: y.year, corporateRevenue: y.revenue, corporateLocationsAtEnd: y.locationsOpenAtEnd })),
    markets,
    terms: franchiseTerms,
    unitSteadyRevenue: base.annualRevenue,
    ramp: scenario.assumptions,
    techPlatformPct: scenario.assumptions.techPlatformPct,
  });
  const exitCorp = portfolio.years[terms.exitYear - 1];
  const exitPlat = platform.years[terms.exitYear - 1];
  if (!exitCorp || !exitPlat) throw new RangeError("exitYear is outside the modeled horizon");

  const corporateEbitda = exitCorp.ebitda;
  const platformGrossProfit = exitPlat.platformGrossProfit;
  const franchiseContribution = (exitPlat.royalties + exitPlat.unitFees) * terms.franchiseMarginPct;
  const exitEbitda = corporateEbitda + platformGrossProfit + franchiseContribution;
  const exitValue = exitEbitda * terms.exitMultiple;
  const requiredExitValue = terms.partnerCapital * terms.targetMultiple;
  const partnerPctReturnBased = exitValue > 0 ? Math.min(1, Math.max(0, requiredExitValue / exitValue)) : 1;
  const partnerPct = roundToFivePct(partnerPctReturnBased);
  const founderPct = 1 - partnerPct;
  const owners: Owner[] = [
    { key: terms.founderKey, pct: founderPct },
    { key: terms.partnerKey, pct: partnerPct },
  ];
  return {
    terms,
    totalCapital: terms.founderCapital + terms.partnerCapital,
    exitEbitda,
    corporateEbitda,
    platformGrossProfit,
    franchiseContribution,
    exitValue,
    requiredExitValue,
    partnerPctReturnBased,
    partnerPct,
    founderPct,
    founderVsBenchmark:
      founderPct < terms.sweatEquityBenchmark.min ? "below" : founderPct > terms.sweatEquityBenchmark.max ? "above" : "within",
    partnerMultipleAtHeadline: terms.partnerCapital > 0 ? (exitValue * partnerPct) / terms.partnerCapital : 0,
    owners,
  };
}
