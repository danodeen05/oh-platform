import { describe, expect, it } from "vitest";
import { BASE_ASSUMPTIONS, FRANCHISE_TERMS, computePlatform, firstYearIndex, type FranchiseMarket } from "../index";

const flatRamp = { rampCurve: new Array<number>(12).fill(1), rampPlateau: 1.06 };

describe("firstYearIndex", () => {
  it("averages the first twelve months of the spec curve", () => {
    expect(firstYearIndex(BASE_ASSUMPTIONS)).toBeCloseTo(11.45 / 12, 9);
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

  it("books new units at half a year and territory fees once", () => {
    expect(y1?.franchiseLocations).toBe(2);
    expect(y1?.systemLocations).toBe(3);
    expect(y1?.franchiseGrossSales).toBeCloseTo(4_000_000, 6);
    expect(y1?.royalties).toBeCloseTo(200_000, 6);
    expect(y1?.marketingFund).toBeCloseTo(80_000, 6);
    expect(y1?.unitFees).toBe(110_000);
    expect(y1?.territoryFees).toBe(500_000);
    expect(y2?.territoryFees).toBe(0);
  });
  it("separates platform, company and system-wide figures", () => {
    expect(y1?.licenseARR).toBe(1800 * 12 * 3);
    expect(y1?.franchiseLicenseFees).toBe(1800 * 12 * 2);
    expect(y1?.corporateTransfer).toBeCloseTo(75_600, 6);
    expect(y1?.platformRevenue).toBeCloseTo(75_600 + 43_200, 6);
    expect(y1?.platformGrossProfit).toBeCloseTo((75_600 + 43_200) * 0.8, 6);
    expect(y1?.companyRevenue).toBeCloseTo(4_200_000 + 43_200 + 200_000 + 110_000 + 500_000, 6);
    expect(y1?.systemWideSales).toBeCloseTo(8_200_000, 6);
  });
  it("matures existing units at the plateau", () => {
    expect(y2?.franchiseLocations).toBe(5);
    expect(y2?.franchiseGrossSales).toBeCloseTo(2 * 4_000_000 * 1.06 + 3 * 4_000_000 * 0.5, 6);
    expect(y2?.corporateLocations).toBe(2);
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
    expect(later.years[1]?.franchiseLocations).toBe(1);
    const none = computePlatform({ corporate: [{ year: 1, corporateRevenue: 1, corporateLocationsAtEnd: 1 }], markets: [], terms: FRANCHISE_TERMS, unitSteadyRevenue: 1, ramp: flatRamp, techPlatformPct: 0 });
    expect(none.years[0]?.franchiseLocations).toBe(0);
    expect(none.years[0]?.companyRevenue).toBe(1);
  });
});
