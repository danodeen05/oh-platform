import type { FranchiseMarket, FranchiseTerms, LocationAssumptions, LocationStructure, PlatformModel, PlatformYear, PlatformYearInput, StructureEconomics } from "./types";

export interface PlatformInput {
  /** Corporate results by plan year, usually from computePortfolio. */
  corporate: readonly PlatformYearInput[];
  markets: readonly FranchiseMarket[];
  terms: FranchiseTerms;
  /** Steady annual revenue of a base franchise unit (auvIndex 1.0). */
  unitSteadyRevenue: number;
  /** Used for the first-year and mature revenue indexes of a franchise unit. */
  ramp: Pick<LocationAssumptions, "rampCurve" | "rampPlateau">;
  /** Corporate techPlatformPct, for the internal transfer line. */
  techPlatformPct: number;
  /** Per-structure economics. Default STRUCTURE_ECONOMICS. */
  structures?: Readonly<Record<LocationStructure, StructureEconomics>>;
}

/**
 * 2026-09-26 (finding F2): what each structure leaves the brand. Before the
 * re-baseline every structure paid 100% of the royalty and the model carried
 * no cost of selling, entering, opening or supporting a market.
 */
export const STRUCTURE_ECONOMICS: Readonly<Record<LocationStructure, StructureEconomics>> = Object.freeze({
  corporate: { royaltyShare: 0, unitFeeShare: 0, salesCostPerMarket: 0, salesCostPerUnit: 0, entryCost: 0, firstOpeningSupport: 0, subsequentOpeningSupport: 0, supportPerUnitPerYear: 0, fxHaircutPct: 0 },
  // US area-development franchise: the brand keeps everything and supports directly.
  franchise: { royaltyShare: 1, unitFeeShare: 1, salesCostPerMarket: 30_000, salesCostPerUnit: 0, entryCost: 25_000, firstOpeningSupport: 25_000, subsequentOpeningSupport: 25_000, supportPerUnitPerYear: 12_000, fxHaircutPct: 0 },
  // Master franchise: the master keeps half, sells and supports locally; the brand trains the first opening.
  "master-franchise": { royaltyShare: 0.5, unitFeeShare: 0.5, salesCostPerMarket: 75_000, salesCostPerUnit: 5_000, entryCost: 120_000, firstOpeningSupport: 50_000, subsequentOpeningSupport: 15_000, supportPerUnitPerYear: 10_000, fxHaircutPct: 0.03 },
  // JV: owner decision 2026-09-26 converted every JV to a master franchise; kept at master economics so the type stays complete.
  jv: { royaltyShare: 0.5, unitFeeShare: 0.5, salesCostPerMarket: 75_000, salesCostPerUnit: 5_000, entryCost: 120_000, firstOpeningSupport: 50_000, subsequentOpeningSupport: 15_000, supportPerUnitPerYear: 10_000, fxHaircutPct: 0.03 },
  // Sub-franchise under a master (London's Paris, Geneva, Barcelona, Rome): a quarter of the royalty reaches the brand.
  "sub-franchise": { royaltyShare: 0.25, unitFeeShare: 0.25, salesCostPerMarket: 0, salesCostPerUnit: 0, entryCost: 60_000, firstOpeningSupport: 10_000, subsequentOpeningSupport: 10_000, supportPerUnitPerYear: 6_000, fxHaircutPct: 0.03 },
});

/** Average ramp index over the first twelve months (spec 5.7 curve). */
export function firstYearIndex(ramp: Pick<LocationAssumptions, "rampCurve" | "rampPlateau">): number {
  let sum = 0;
  for (let m = 0; m < 12; m++) sum += ramp.rampCurve[m] ?? ramp.rampPlateau;
  return sum / 12;
}

/**
 * Oh! OS and franchise economics (spec 5.9 and 5.10), re-based 2026-09-26.
 *
 * Franchise units opened in a year are assumed to open mid-year, so they
 * trade six months at the first-year ramp index; units from earlier years
 * trade the full year at the plateau. Royalties and unit fees are reported
 * gross (what franchisees pay) and brand-received (after the master's share
 * and an FX haircut on non-USD markets); `royalties` and `unitFees` are the
 * brand-received figures. Sales, entry, opening and per-unit support costs
 * are booked when incurred. `companyRevenue` excludes the internal platform
 * transfer and the pass-through marketing fund; `systemWideSales` is
 * corporate plus franchisee gross sales and must never be labeled as ours.
 */
export function computePlatform(input: PlatformInput): PlatformModel {
  const { corporate, markets, terms, unitSteadyRevenue, ramp, techPlatformPct } = input;
  const structures = input.structures ?? STRUCTURE_ECONOMICS;
  const yearOneIndex = firstYearIndex(ramp);
  const years: PlatformYear[] = [];
  const openUnitsByMarket = new Map<string, number>();

  for (const c of corporate) {
    let newUnits = 0;
    let franchiseGrossSales = 0;
    let territoryFees = 0;
    let grossRoyalties = 0;
    let brandRoyalties = 0;
    let grossUnitFees = 0;
    let brandUnitFees = 0;
    let oneTimeCost = 0;
    let recurringCost = 0;
    for (const market of markets) {
      const econ = structures[market.structure];
      const existing = openUnitsByMarket.get(market.key) ?? 0;
      const opened = market.unitsByYear[c.year] ?? 0;
      const unitRevenue = unitSteadyRevenue * market.auvIndex;
      const sales = existing * unitRevenue * ramp.rampPlateau + opened * unitRevenue * yearOneIndex * 0.5;
      franchiseGrossSales += sales;
      const fx = (market.currency ?? "USD") === "USD" ? 0 : econ.fxHaircutPct;
      const royalty = sales * terms.royaltyPct;
      grossRoyalties += royalty;
      brandRoyalties += royalty * econ.royaltyShare * (1 - fx);
      const fees = opened * terms.unitFranchiseFee;
      grossUnitFees += fees;
      brandUnitFees += fees * econ.unitFeeShare;
      newUnits += opened;
      if (market.territoryYear === c.year) {
        territoryFees += market.territoryFee;
        oneTimeCost += econ.salesCostPerMarket + econ.entryCost;
      }
      if (opened > 0) {
        const first = existing === 0 ? 1 : 0;
        oneTimeCost += opened * econ.salesCostPerUnit + first * econ.firstOpeningSupport + (opened - first) * econ.subsequentOpeningSupport;
      }
      const openAtEnd = existing + opened;
      recurringCost += openAtEnd * econ.supportPerUnitPerYear;
      openUnitsByMarket.set(market.key, openAtEnd);
    }
    let franchiseLocations = 0;
    for (const n of openUnitsByMarket.values()) franchiseLocations += n;

    const systemLocations = c.corporateLocationsAtEnd + franchiseLocations;
    const licenseARR = terms.platformLicenseMonthly * 12 * systemLocations;
    const franchiseLicenseFees = terms.platformLicenseMonthly * 12 * franchiseLocations;
    const corporateTransfer = c.corporateRevenue * techPlatformPct;
    const marketingFund = franchiseGrossSales * terms.marketingFundPct;
    const platformRevenue = corporateTransfer + franchiseLicenseFees;
    const franchiseSupportCost = oneTimeCost + recurringCost;

    years.push({
      year: c.year,
      corporateLocations: c.corporateLocationsAtEnd,
      franchiseLocations,
      systemLocations,
      licenseARR,
      corporateTransfer,
      franchiseGrossSales,
      grossRoyalties,
      brandRoyalties,
      royalties: brandRoyalties,
      marketingFund,
      grossUnitFees,
      unitFees: brandUnitFees,
      territoryFees,
      franchiseSupportCost,
      franchiseContribution: brandRoyalties + brandUnitFees + territoryFees - franchiseSupportCost,
      recurringFranchiseProfit: brandRoyalties - recurringCost,
      franchiseLicenseFees,
      platformRevenue,
      platformGrossProfit: platformRevenue * terms.platformGrossMarginPct,
      companyRevenue: c.corporateRevenue + franchiseLicenseFees + brandRoyalties + brandUnitFees + territoryFees,
      systemWideSales: c.corporateRevenue + franchiseGrossSales,
    });
  }

  return { years };
}
