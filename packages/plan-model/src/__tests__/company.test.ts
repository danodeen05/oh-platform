import { describe, expect, it } from "vitest";
import { BASE, FRANCHISE_MARKETS, FRANCHISE_TERMS, OPENING_SCHEDULE, computeCompany } from "../index";

const input = { scenario: BASE, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS };

describe("computeCompany", () => {
  const c = computeCompany(input);
  it("reconciles every row to the portfolio and platform it was built from", () => {
    expect(c.years).toHaveLength(5);
    c.years.forEach((y, i) => {
      const p = c.portfolio.years[i];
      const f = c.platform.years[i];
      expect(y.corporateRevenue).toBe(p?.revenue);
      expect(y.unitEbitda).toBe(p?.ebitda);
      expect(y.corporateOverhead).toBe(p?.corporateOverhead);
      expect(y.franchiseContribution).toBe(f?.franchiseContribution);
      expect(y.platformGrossProfit).toBe(f?.platformGrossProfit);
      expect(y.consolidatedEbitda).toBeCloseTo((p?.consolidatedEbitda ?? 0) + (f?.franchiseContribution ?? 0) + (f?.platformGrossProfit ?? 0), 6);
      expect(y.recurringEbitda).toBeCloseTo(y.unitEbitda - y.corporateOverhead + y.recurringFranchiseProfit + y.platformGrossProfit, 6);
      expect(y.freeCashFlow).toBeCloseTo(y.consolidatedEbitda - y.taxDistributions - y.maintenanceCapex - y.growthCapex - y.investments, 6);
      expect(y.companyRevenue).toBe(f?.companyRevenue);
    });
    expect(c.years[0]?.cumulativeCash).toBeCloseTo((c.years[0]?.equityRaised ?? 0) + (c.years[0]?.freeCashFlow ?? 0), 6);
    expect(c.minimumCash).toBe(Math.min(...c.years.map((y) => y.cumulativeCash)));
  });
  it("staffs franchise support from the market schedule", () => {
    const y5 = c.portfolio.years[4];
    expect(y5?.corporateOverhead).toBeGreaterThan(0);
    expect(c.years[4]?.franchiseLocations).toBe(7);
  });
  it("taxes profits once the loss carryforward is used up", () => {
    const rich = computeCompany(input, { years: 12 });
    const taxed = rich.years.filter((y) => y.taxDistributions > 0);
    expect(taxed.length).toBeGreaterThan(0);
    const first = taxed[0];
    expect(first?.taxDistributions).toBeLessThanOrEqual(((first?.consolidatedEbitda ?? 0) - (first?.depreciation ?? 0)) * 0.37 + 1e-6);
    const custom = computeCompany(input, { years: 12, taxDistributionRate: 0 });
    expect(custom.years.every((y) => y.taxDistributions === 0)).toBe(true);
  });
  it("handles an empty horizon", () => {
    const none = computeCompany(input, { years: 0 });
    expect(none.years).toEqual([]);
    expect(none.minimumCash).toBe(0);
  });
});
