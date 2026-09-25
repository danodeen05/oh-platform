import type { FranchiseMarket, FranchiseTerms, LocationAssumptions, PlatformModel, PlatformYear, PlatformYearInput } from "./types";

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
}

/** Average ramp index over the first twelve months (spec 5.7 curve). */
export function firstYearIndex(ramp: Pick<LocationAssumptions, "rampCurve" | "rampPlateau">): number {
  let sum = 0;
  for (let m = 0; m < 12; m++) sum += ramp.rampCurve[m] ?? ramp.rampPlateau;
  return sum / 12;
}

/**
 * Oh! OS and franchise economics (spec 5.9 and 5.10).
 *
 * Franchise units opened in a year are assumed to open mid-year, so they
 * trade six months at the first-year ramp index; units from earlier years
 * trade the full year at the plateau. `companyRevenue` excludes the internal
 * platform transfer and the pass-through marketing fund; `systemWideSales`
 * is corporate plus franchisee gross sales and must never be labeled as ours.
 */
export function computePlatform(input: PlatformInput): PlatformModel {
  const { corporate, markets, terms, unitSteadyRevenue, ramp, techPlatformPct } = input;
  const yearOneIndex = firstYearIndex(ramp);
  const years: PlatformYear[] = [];
  const openUnitsByMarket = new Map<string, number>();

  for (const c of corporate) {
    let newUnits = 0;
    let franchiseGrossSales = 0;
    let territoryFees = 0;
    for (const market of markets) {
      const existing = openUnitsByMarket.get(market.key) ?? 0;
      const opened = market.unitsByYear[c.year] ?? 0;
      const unitRevenue = unitSteadyRevenue * market.auvIndex;
      franchiseGrossSales += existing * unitRevenue * ramp.rampPlateau + opened * unitRevenue * yearOneIndex * 0.5;
      newUnits += opened;
      openUnitsByMarket.set(market.key, existing + opened);
      if (market.territoryYear === c.year) territoryFees += market.territoryFee;
    }
    let franchiseLocations = 0;
    for (const n of openUnitsByMarket.values()) franchiseLocations += n;

    const systemLocations = c.corporateLocationsAtEnd + franchiseLocations;
    const licenseARR = terms.platformLicenseMonthly * 12 * systemLocations;
    const franchiseLicenseFees = terms.platformLicenseMonthly * 12 * franchiseLocations;
    const corporateTransfer = c.corporateRevenue * techPlatformPct;
    const royalties = franchiseGrossSales * terms.royaltyPct;
    const marketingFund = franchiseGrossSales * terms.marketingFundPct;
    const unitFees = newUnits * terms.unitFranchiseFee;
    const platformRevenue = corporateTransfer + franchiseLicenseFees;

    years.push({
      year: c.year,
      corporateLocations: c.corporateLocationsAtEnd,
      franchiseLocations,
      systemLocations,
      licenseARR,
      corporateTransfer,
      franchiseGrossSales,
      royalties,
      marketingFund,
      unitFees,
      territoryFees,
      franchiseLicenseFees,
      platformRevenue,
      platformGrossProfit: platformRevenue * terms.platformGrossMarginPct,
      companyRevenue: c.corporateRevenue + franchiseLicenseFees + royalties + unitFees + territoryFees,
      systemWideSales: c.corporateRevenue + franchiseGrossSales,
    });
  }

  return { years };
}
