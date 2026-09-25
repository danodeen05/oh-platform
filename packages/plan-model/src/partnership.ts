import { computePlatform } from "./platform";
import { computePortfolio } from "./portfolio";
import type { FranchiseMarket, FranchiseTerms, OpeningPlan, Owner, OwnershipImpact, OwnershipImpactYear, OwnershipModel, PartnershipTerms, Scenario } from "./types";
import { computeLocation } from "./location";

export interface OwnershipInput {
  scenario: Scenario;
  terms: PartnershipTerms;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  franchiseTerms: FranchiseTerms;
}

/** Round UP to the next 5% and keep inside 0..1, so the partner's target is met, never just missed. */
export function roundToFivePct(value: number): number {
  return Math.min(1, Math.max(0, Math.ceil(value * 20 - 1e-9) / 20));
}

/**
 * Implied partner ownership for a single financial partner (owner decision
 * 2026-09-25). Two lenses, both from the engine:
 *
 * Return-based (the venture method): the partner needs partnerCapital ×
 * targetMultiple back by the exit year. Ownership is that amount over
 * everything an owner receives through the horizon: yearly distributions
 * (distributionPct of corporate EBITDA) plus the exit value, where exit
 * value is exit-year EBITDA (corporate units plus the platform gross profit
 * plus the franchise contribution) times the exit multiple.
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
  const totalDistributions = portfolio.years.reduce((sum, y) => sum + Math.max(0, y.ebitda) * terms.distributionPct, 0);
  const ownerProceeds = exitValue + totalDistributions;
  const requiredExitValue = terms.partnerCapital * terms.targetMultiple;
  const partnerPctReturnBased = ownerProceeds > 0 ? Math.min(1, Math.max(0, requiredExitValue / ownerProceeds)) : 1;
  const rounded = roundToFivePct(partnerPctReturnBased);
  const cappedByOwner = rounded > terms.partnerPctCap;
  const partnerPct = cappedByOwner ? terms.partnerPctCap : rounded;
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
    totalDistributions,
    requiredExitValue,
    partnerPctReturnBased,
    partnerPct,
    cappedByOwner,
    founderPct,
    founderVsBenchmark:
      founderPct < terms.sweatEquityBenchmark.min ? "below" : founderPct > terms.sweatEquityBenchmark.max ? "above" : "within",
    partnerMultipleAtHeadline: terms.partnerCapital > 0 ? (ownerProceeds * partnerPct) / terms.partnerCapital : 0,
    owners,
  };
}

export interface ImpactOptions {
  /** Partner ownership to evaluate. Defaults to the model's headline. */
  partnerPct?: number;
  /** Override the return target, e.g. 5 to see the 5x case. */
  targetMultiple?: number;
  /** Override the exit multiple. */
  exitMultiple?: number;
}

/**
 * Founder-side and partner-side outcomes for one split (owner request
 * 2026-09-25: "understand my own financial impact by how much of the company
 * I'm giving up"). Yearly distributions are distributionPct of corporate
 * EBITDA split by ownership; the exit shares the exit value the same way.
 * buyoutAtTarget is the founder's cost to end the partnership at the exit
 * year while still delivering the partner's target.
 */
export function computeOwnershipImpact(input: OwnershipInput, options: ImpactOptions = {}): OwnershipImpact {
  const { scenario, terms, schedule } = input;
  const base = computeOwnership(input);
  const partnerPct = Math.min(1, Math.max(0, options.partnerPct ?? base.partnerPct));
  const founderPct = 1 - partnerPct;
  const targetMultiple = options.targetMultiple ?? terms.targetMultiple;
  const exitMultiple = options.exitMultiple ?? terms.exitMultiple;
  const portfolio = computePortfolio(schedule, scenario, { years: terms.exitYear });

  const years: OwnershipImpactYear[] = [];
  let cumulativePartner = 0;
  let founderCumulativeDistributions = 0;
  let partnerCumulativeDistributions = 0;
  let targetYearFromDistributions: number | null = null;
  const required = terms.partnerCapital * targetMultiple;
  for (const y of portfolio.years) {
    const distributions = Math.max(0, y.ebitda) * terms.distributionPct;
    const founderDistribution = distributions * founderPct;
    const partnerDistribution = distributions * partnerPct;
    founderCumulativeDistributions += founderDistribution;
    partnerCumulativeDistributions += partnerDistribution;
    cumulativePartner += partnerDistribution;
    if (targetYearFromDistributions === null && terms.partnerCapital > 0 && cumulativePartner >= required) targetYearFromDistributions = y.year;
    years.push({
      year: y.year,
      corporateEbitda: y.ebitda,
      distributions,
      founderDistribution,
      partnerDistribution,
      cumulativePartnerReturn: cumulativePartner,
      partnerMultipleToDate: terms.partnerCapital > 0 ? cumulativePartner / terms.partnerCapital : 0,
    });
  }

  const exitValue = base.exitEbitda * exitMultiple;
  const founderExitProceeds = exitValue * founderPct;
  const partnerExitProceeds = exitValue * partnerPct;
  const partnerTotal = partnerCumulativeDistributions + partnerExitProceeds;
  const buyoutAtTarget = Math.max(0, required - partnerCumulativeDistributions);
  return {
    partnerPct,
    founderPct,
    targetMultiple,
    exitMultiple,
    years,
    exitValue,
    founderExitProceeds,
    partnerExitProceeds,
    founderCumulativeDistributions,
    partnerCumulativeDistributions,
    founderTotal: founderCumulativeDistributions + founderExitProceeds,
    partnerTotal,
    partnerMultipleAtExit: terms.partnerCapital > 0 ? partnerTotal / terms.partnerCapital : 0,
    targetYearFromDistributions,
    buyoutAtTarget,
    buyoutVsMarket: partnerExitProceeds > 0 ? buyoutAtTarget / partnerExitProceeds : 0,
  };
}

/** Grid of impacts across partner stakes and return targets, for the Funding module table. */
export function ownershipImpactGrid(input: OwnershipInput, partnerPcts: readonly number[], targetMultiples: readonly number[]): readonly (readonly OwnershipImpact[])[] {
  return targetMultiples.map((t) => partnerPcts.map((p) => computeOwnershipImpact(input, { partnerPct: p, targetMultiple: t })));
}
