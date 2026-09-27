import { computeCompany, type CompanyModel, type CompanyYear } from "./company";
import type { FranchiseMarket, FranchiseTerms, OpeningPlan, Owner, OwnershipImpact, OwnershipImpactYear, OwnershipModel, PartnershipTerms, PreferredConstruct, Scenario } from "./types";

export interface OwnershipInput {
  scenario: Scenario;
  terms: PartnershipTerms;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  franchiseTerms: FranchiseTerms;
}

export interface OwnershipOptions {
  /** Plan year of the exit. Defaults to terms.exitYear; the owner asked to see 5 and 7. */
  exitYear?: number;
  /** Override the exit multiple. */
  exitMultiple?: number;
  /** Apply HYBRID_EXIT_MULTIPLE when the recurring franchise share clears HYBRID_RECURRING_SHARE_MIN. Default false. */
  hybrid?: boolean;
}

/** A franchisor-weighted multiple, only defensible once recurring franchise profit is a real share of EBITDA. */
export const HYBRID_EXIT_MULTIPLE = 6;
export const HYBRID_RECURRING_SHARE_MIN = 0.25;

/** Round UP to the next 5% and keep inside 0..1, so the partner's target is met, never just missed. */
export function roundToFivePct(value: number): number {
  return Math.min(1, Math.max(0, Math.ceil(value * 20 - 1e-9) / 20));
}

/** Pref accrued through `exitYear` on capital invested per the schedule: simple, from the year after each tranche lands. */
export function accruedPreference(terms: PartnershipTerms, exitYear: number): number {
  const rate = terms.preferredReturnPct ?? 0.08;
  const schedule = terms.partnerCapitalSchedule ?? [{ year: 1, amount: terms.partnerCapital }];
  return schedule.reduce((s, t) => s + t.amount * rate * Math.max(0, exitYear - t.year), 0);
}

function distributableOf(y: CompanyYear): number {
  return Math.max(0, y.freeCashFlow);
}

function exitEbitdaOf(y: CompanyYear, terms: PartnershipTerms): { exitEbitda: number; franchiseContribution: number } {
  const recurringOnly = terms.recurringOnlyExit ?? true;
  return recurringOnly
    ? { exitEbitda: y.recurringEbitda, franchiseContribution: y.recurringFranchiseProfit }
    : { exitEbitda: y.consolidatedEbitda, franchiseContribution: y.franchiseContribution };
}

/**
 * Implied partner ownership for a single financial partner (owner decisions
 * 2026-09-25 and 2026-09-26). Everything is derived from the engine; nothing
 * is asserted.
 *
 * Return-based common: the partner needs partnerCapital × targetMultiple
 * back by the exit year. Ownership is that amount over everything an owner
 * receives through the horizon: yearly distributions (distributionPct of
 * post-tax free cash flow) plus the exit value, where exit value is the
 * exit-year consolidated, recurring-only EBITDA (unit EBITDA less corporate
 * overhead, plus recurring franchise profit and platform gross profit)
 * times the exit multiple. The headline is rounded up to 5% and capped at
 * partnerPctCap; when the cap binds, `cappedByOwner` is true and
 * `partnerMultipleAtHeadline` says what the partner actually gets, so the
 * gap is never hidden.
 *
 * Preferred construct: the same cash flows with an 8% simple preferred
 * return and a 1x liquidation preference ahead of common. Distributions pay
 * the accrued pref first; at the exit the unpaid pref and the preference
 * are settled before the residual is shared by common, and the partner's
 * common stake is derived from what is left, with the same cap.
 *
 * Sweat-equity benchmark: what an operator who brings the concept and runs
 * the company typically keeps when a partner funds all capital (25% to 40%).
 */
export function computeOwnership(input: OwnershipInput, options: OwnershipOptions = {}): OwnershipModel {
  const { scenario, terms, schedule, markets, franchiseTerms } = input;
  const exitYear = options.exitYear ?? terms.exitYear;
  if (exitYear < 1) throw new RangeError("exitYear is outside the modeled horizon");
  const company = computeCompany({ scenario, schedule, markets, franchiseTerms }, { years: exitYear, taxDistributionRate: terms.taxDistributionRate ?? 0.37 });
  const exit = company.years[exitYear - 1] as CompanyYear;
  const { exitEbitda, franchiseContribution } = exitEbitdaOf(exit, terms);
  const recurringFranchiseShare = exitEbitda > 0 ? exit.recurringFranchiseProfit / exitEbitda : 0;
  const hybridEligible = recurringFranchiseShare >= HYBRID_RECURRING_SHARE_MIN;
  const exitMultiple = options.exitMultiple ?? (options.hybrid && hybridEligible ? HYBRID_EXIT_MULTIPLE : terms.exitMultiple);
  const exitValue = exitEbitda * exitMultiple;
  const totalDistributions = company.years.reduce((sum, y) => sum + distributableOf(y) * terms.distributionPct, 0);
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
  const partnerMultipleAtHeadline = terms.partnerCapital > 0 ? (ownerProceeds * partnerPct) / terms.partnerCapital : 0;
  return {
    terms,
    totalCapital: terms.founderCapital + terms.partnerCapital,
    exitEbitda,
    corporateEbitda: exit.unitEbitda,
    corporateOverhead: exit.corporateOverhead,
    platformGrossProfit: exit.platformGrossProfit,
    franchiseContribution,
    recurringFranchiseShare,
    exitYear,
    exitMultiple,
    hybridEligible,
    exitValue,
    totalDistributions,
    requiredExitValue,
    partnerPctReturnBased,
    partnerPct,
    cappedByOwner,
    founderPct,
    founderVsBenchmark:
      founderPct < terms.sweatEquityBenchmark.min ? "below" : founderPct > terms.sweatEquityBenchmark.max ? "above" : "within",
    partnerMultipleAtHeadline,
    impliedMultipleAtCap: cappedByOwner ? partnerMultipleAtHeadline : terms.targetMultiple,
    owners,
    preferred: computePreferred(company, terms, exitYear, exitValue),
  };
}

/** The preferred-equity waterfall on the company's cash flows. */
export function computePreferred(company: CompanyModel, terms: PartnershipTerms, exitYear: number, exitValue: number): PreferredConstruct {
  const preferredReturnPct = terms.preferredReturnPct ?? 0.08;
  const liquidationPreference = terms.liquidationPreference ?? 1;
  const accrued = accruedPreference(terms, exitYear);
  let unpaidPref = 0;
  let paidFromDistributions = 0;
  let commonDistributions = 0;
  const schedule = terms.partnerCapitalSchedule ?? [{ year: 1, amount: terms.partnerCapital }];
  for (const y of company.years) {
    // Pref for this year accrues on tranches invested in earlier years.
    unpaidPref += schedule.reduce((s, t) => s + (t.year < y.year ? t.amount * preferredReturnPct : 0), 0);
    const pool = distributableOf(y) * terms.distributionPct;
    const toPref = Math.min(pool, unpaidPref);
    unpaidPref -= toPref;
    paidFromDistributions += toPref;
    commonDistributions += pool - toPref;
  }
  const preferencePaidAtExit = Math.min(Math.max(0, exitValue), unpaidPref);
  const liquidationPaid = Math.min(Math.max(0, exitValue - preferencePaidAtExit), liquidationPreference * terms.partnerCapital);
  const residualExitValue = Math.max(0, exitValue - preferencePaidAtExit - liquidationPaid);
  const required = terms.partnerCapital * terms.targetMultiple;
  const fromStack = paidFromDistributions + preferencePaidAtExit + liquidationPaid;
  const commonPool = commonDistributions + residualExitValue;
  const stillNeeded = Math.max(0, required - fromStack);
  const partnerCommonPctReturnBased = commonPool > 0 ? Math.min(1, stillNeeded / commonPool) : stillNeeded > 0 ? 1 : 0;
  const rounded = roundToFivePct(partnerCommonPctReturnBased);
  const cappedByOwner = rounded > terms.partnerPctCap;
  const partnerCommonPct = cappedByOwner ? terms.partnerPctCap : rounded;
  const partnerTotal = fromStack + commonPool * partnerCommonPct;
  return {
    preferredReturnPct,
    liquidationPreference,
    accruedPreference: accrued,
    preferencePaidFromDistributions: paidFromDistributions,
    preferencePaidAtExit,
    liquidationPaid,
    residualExitValue,
    commonDistributions,
    partnerCommonPctReturnBased,
    partnerCommonPct,
    cappedByOwner,
    founderCommonPct: 1 - partnerCommonPct,
    partnerTotal,
    founderTotal: commonPool * (1 - partnerCommonPct),
    partnerMultiple: terms.partnerCapital > 0 ? partnerTotal / terms.partnerCapital : 0,
  };
}

export interface ImpactOptions {
  /** Partner ownership to evaluate. Defaults to the model's headline. */
  partnerPct?: number;
  /** Override the return target, e.g. 5 to see the 5x case. */
  targetMultiple?: number;
  /** Override the exit multiple. */
  exitMultiple?: number;
  /** 2026-09-26: plan year of the exit (5 or 7). Defaults to terms.exitYear. */
  exitYear?: number;
  /** 2026-09-26: use the hybrid multiple when eligible. */
  hybrid?: boolean;
}

/**
 * Founder-side and partner-side outcomes for one split (owner request
 * 2026-09-25: "understand my own financial impact by how much of the company
 * I'm giving up"). Yearly distributions are distributionPct of post-tax free
 * cash flow split by ownership; the exit shares the exit value the same way.
 * buyoutAtTarget is the founder's cost to end the partnership at the exit
 * year while still delivering the partner's target.
 */
export function computeOwnershipImpact(input: OwnershipInput, options: ImpactOptions = {}): OwnershipImpact {
  const { scenario, terms, schedule, markets, franchiseTerms } = input;
  const ownershipOptions: OwnershipOptions = {
    ...(options.exitYear !== undefined ? { exitYear: options.exitYear } : {}),
    ...(options.exitMultiple !== undefined ? { exitMultiple: options.exitMultiple } : {}),
    ...(options.hybrid !== undefined ? { hybrid: options.hybrid } : {}),
  };
  const base = computeOwnership(input, ownershipOptions);
  const partnerPct = Math.min(1, Math.max(0, options.partnerPct ?? base.partnerPct));
  const founderPct = 1 - partnerPct;
  const targetMultiple = options.targetMultiple ?? terms.targetMultiple;
  const exitMultiple = base.exitMultiple;
  const company = computeCompany({ scenario, schedule, markets, franchiseTerms }, { years: base.exitYear, taxDistributionRate: terms.taxDistributionRate ?? 0.37 });

  const years: OwnershipImpactYear[] = [];
  let cumulativePartner = 0;
  let founderCumulativeDistributions = 0;
  let partnerCumulativeDistributions = 0;
  let targetYearFromDistributions: number | null = null;
  const required = terms.partnerCapital * targetMultiple;
  for (const y of company.years) {
    const distributable = distributableOf(y);
    const distributions = distributable * terms.distributionPct;
    const founderDistribution = distributions * founderPct;
    const partnerDistribution = distributions * partnerPct;
    founderCumulativeDistributions += founderDistribution;
    partnerCumulativeDistributions += partnerDistribution;
    cumulativePartner += partnerDistribution;
    if (targetYearFromDistributions === null && terms.partnerCapital > 0 && cumulativePartner >= required) targetYearFromDistributions = y.year;
    years.push({
      year: y.year,
      corporateEbitda: y.unitEbitda,
      consolidatedEbitda: y.consolidatedEbitda,
      distributable,
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
