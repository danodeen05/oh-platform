import { describe, expect, it } from "vitest";
import { FRANCHISE_TERMS, LEGACY_BASE_ASSUMPTIONS, STRUCTURE_ECONOMICS, computePlatform, firstYearIndex, type FranchiseMarket } from "../index";

const flatRamp = { rampCurve: new Array<number>(12).fill(1), rampPlateau: 1.06 };

describe("firstYearIndex", () => {
  it("averages the first twelve months of the spec curve", () => {
    expect(firstYearIndex(LEGACY_BASE_ASSUMPTIONS)).toBeCloseTo(11.45 / 12, 9);
  });
  it("uses the plateau when the curve is shorter than a year", () => {
    expect(firstYearIndex({ rampCurve: [0.5], rampPlateau: 1 })).toBeCloseTo((0.5 + 11) / 12, 9);
  });
});

describe("computePlatform", () => {
  const market: FranchiseMarket = {
    key: "m",
    name: "Market",
    structure: "master-franchise",
    territoryFee: 500_000,
    territoryYear: 1,
    unitsByYear: { 1: 2, 2: 3 },
    auvIndex: 1,
    currency: "TWD",
  };
  const model = computePlatform({
    corporate: [
      { year: 1, corporateRevenue: 4_200_000, corporateLocationsAtEnd: 1 },
      { year: 2, corporateRevenue: 8_400_000, corporateLocationsAtEnd: 2 },
    ],
    markets: [market],
    terms: FRANCHISE_TERMS,
    unitSteadyRevenue: 4_000_000,
    ramp: flatRamp,
    techPlatformPct: 0.018,
  });
  const y1 = model.years[0];
  const y2 = model.years[1];
  const master = STRUCTURE_ECONOMICS["master-franchise"];

  it("books new units at half a year and territory fees once", () => {
    expect(y1?.franchiseLocations).toBe(2);
    expect(y1?.systemLocations).toBe(3);
    expect(y1?.franchiseGrossSales).toBeCloseTo(4_000_000, 6);
    expect(y1?.grossRoyalties).toBeCloseTo(200_000, 6);
    expect(y1?.marketingFund).toBeCloseTo(80_000, 6);
    expect(y1?.grossUnitFees).toBe(110_000);
    expect(y1?.territoryFees).toBe(500_000);
    expect(y2?.territoryFees).toBe(0);
  });
  it("hands the master half the royalty and unit fee, and takes the FX haircut on a non-USD market", () => {
    expect(y1?.brandRoyalties).toBeCloseTo(200_000 * 0.5 * (1 - 0.03), 6);
    expect(y1?.royalties).toBe(y1?.brandRoyalties);
    expect(y1?.unitFees).toBe(55_000);
  });
  it("books sales, entry, opening and per-unit support costs", () => {
    // Year 1: market signed (sales + entry), two units opened (per-unit sales, first + one subsequent opening), two units supported.
    const oneTime = master.salesCostPerMarket + master.entryCost + 2 * master.salesCostPerUnit + master.firstOpeningSupport + master.subsequentOpeningSupport;
    expect(y1?.franchiseSupportCost).toBe(oneTime + 2 * master.supportPerUnitPerYear);
    expect(y1?.franchiseContribution).toBeCloseTo((y1?.royalties ?? 0) + 55_000 + 500_000 - (y1?.franchiseSupportCost ?? 0), 6);
    expect(y1?.recurringFranchiseProfit).toBeCloseTo((y1?.royalties ?? 0) - 2 * master.supportPerUnitPerYear, 6);
    // Year 2: three more units in an existing market, all subsequent openings.
    expect(y2?.franchiseSupportCost).toBe(3 * master.salesCostPerUnit + 3 * master.subsequentOpeningSupport + 5 * master.supportPerUnitPerYear);
  });
  it("separates platform, company and system-wide figures", () => {
    expect(y1?.licenseARR).toBe(1800 * 12 * 3);
    expect(y1?.franchiseLicenseFees).toBe(1800 * 12 * 2);
    expect(y1?.corporateTransfer).toBeCloseTo(75_600, 6);
    expect(y1?.platformRevenue).toBeCloseTo(75_600 + 43_200, 6);
    expect(y1?.platformGrossProfit).toBeCloseTo((75_600 + 43_200) * 0.8, 6);
    expect(y1?.companyRevenue).toBeCloseTo(4_200_000 + 43_200 + (y1?.royalties ?? 0) + 55_000 + 500_000, 6);
    expect(y1?.systemWideSales).toBeCloseTo(8_200_000, 6);
  });
  it("matures existing units at the plateau", () => {
    expect(y2?.franchiseLocations).toBe(5);
    expect(y2?.franchiseGrossSales).toBeCloseTo(2 * 4_000_000 * 1.06 + 3 * 4_000_000 * 0.5, 6);
    expect(y2?.corporateLocations).toBe(2);
  });
  it("gives a US area franchise the full royalty with no haircut", () => {
    const us = computePlatform({
      corporate: [{ year: 1, corporateRevenue: 0, corporateLocationsAtEnd: 0 }],
      markets: [{ ...market, structure: "franchise", territoryFee: 100_000, unitsByYear: { 1: 1 }, currency: "USD" }],
      terms: FRANCHISE_TERMS,
      unitSteadyRevenue: 4_000_000,
      ramp: flatRamp,
      techPlatformPct: 0,
    });
    const f = STRUCTURE_ECONOMICS.franchise;
    expect(us.years[0]?.royalties).toBeCloseTo(100_000, 6);
    expect(us.years[0]?.unitFees).toBe(55_000);
    expect(us.years[0]?.franchiseSupportCost).toBe(f.salesCostPerMarket + f.entryCost + f.firstOpeningSupport + f.supportPerUnitPerYear);
  });
  it("accepts custom structure economics", () => {
    const free = { ...STRUCTURE_ECONOMICS, "master-franchise": { ...master, royaltyShare: 1, fxHaircutPct: 0 } };
    const m = computePlatform({ corporate: [{ year: 1, corporateRevenue: 0, corporateLocationsAtEnd: 0 }], markets: [market], terms: FRANCHISE_TERMS, unitSteadyRevenue: 4_000_000, ramp: flatRamp, techPlatformPct: 0, structures: free });
    expect(m.years[0]?.royalties).toBeCloseTo(200_000, 6);
  });
  it("applies the AUV index and handles years with no openings", () => {
    const m = computePlatform({
      corporate: [{ year: 3, corporateRevenue: 0, corporateLocationsAtEnd: 0 }],
      markets: [{ ...market, auvIndex: 0.5, unitsByYear: { 3: 1 }, territoryYear: 9 }],
      terms: FRANCHISE_TERMS,
      unitSteadyRevenue: 4_000_000,
      ramp: flatRamp,
      techPlatformPct: 0.018,
    });
    expect(m.years[0]?.franchiseGrossSales).toBeCloseTo(1_000_000, 6);
    expect(m.years[0]?.territoryFees).toBe(0);
    // A year with no entry in unitsByYear opens nothing.
    const later = computePlatform({
      corporate: [
        { year: 1, corporateRevenue: 0, corporateLocationsAtEnd: 0 },
        { year: 2, corporateRevenue: 0, corporateLocationsAtEnd: 0 },
      ],
      markets: [{ ...market, unitsByYear: { 2: 1 }, territoryYear: 2 }],
      terms: FRANCHISE_TERMS,
      unitSteadyRevenue: 4_000_000,
      ramp: flatRamp,
      techPlatformPct: 0,
    });
    expect(later.years[0]?.franchiseLocations).toBe(0);
    expect(later.years[0]?.unitFees).toBe(0);
    expect(later.years[0]?.franchiseSupportCost).toBe(0);
    expect(later.years[1]?.franchiseLocations).toBe(1);
    const none = computePlatform({ corporate: [{ year: 1, corporateRevenue: 1, corporateLocationsAtEnd: 1 }], markets: [], terms: FRANCHISE_TERMS, unitSteadyRevenue: 1, ramp: flatRamp, techPlatformPct: 0 });
    expect(none.years[0]?.franchiseLocations).toBe(0);
    expect(none.years[0]?.companyRevenue).toBe(1);
  });
  it("treats a market without a currency as USD", () => {
    const { currency: _drop, ...usd } = market;
    void _drop;
    const m = computePlatform({ corporate: [{ year: 1, corporateRevenue: 0, corporateLocationsAtEnd: 0 }], markets: [usd], terms: FRANCHISE_TERMS, unitSteadyRevenue: 4_000_000, ramp: flatRamp, techPlatformPct: 0 });
    expect(m.years[0]?.royalties).toBeCloseTo(100_000, 6);
  });
});
