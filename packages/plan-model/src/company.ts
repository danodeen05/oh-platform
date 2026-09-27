import { DEFAULT_TAX_DISTRIBUTION_RATE } from "./assumptions/index";
import { computeLocation } from "./location";
import { computePlatform } from "./platform";
import { computePortfolio, type PortfolioOptions } from "./portfolio";
import type { FranchiseMarket, FranchiseTerms, OpeningPlan, PlatformModel, PortfolioModel, Scenario } from "./types";

export interface CompanyInput {
  scenario: Scenario;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  franchiseTerms: FranchiseTerms;
}

export interface CompanyYear {
  year: number;
  corporateRevenue: number;
  companyRevenue: number;
  systemWideSales: number;
  corporateLocations: number;
  franchiseLocations: number;
  /** Four-wall EBITDA of the corporate units. */
  unitEbitda: number;
  preOpeningExpense: number;
  corporateOverhead: number;
  /** Brand royalties + brand unit fees + territory fees − franchise support cost. */
  franchiseContribution: number;
  recurringFranchiseProfit: number;
  platformGrossProfit: number;
  /** unitEbitda − preOpening − overhead + franchiseContribution + platformGrossProfit. */
  consolidatedEbitda: number;
  /** unitEbitda − overhead + recurringFranchiseProfit + platformGrossProfit: what an acquirer capitalizes. */
  recurringEbitda: number;
  depreciation: number;
  taxDistributions: number;
  maintenanceCapex: number;
  growthCapex: number;
  investments: number;
  equityRaised: number;
  freeCashFlow: number;
  cumulativeCash: number;
}

export interface CompanyModel {
  portfolio: PortfolioModel;
  platform: PlatformModel;
  years: readonly CompanyYear[];
  minimumCash: number;
}

/**
 * The whole company by plan year (2026-09-26): corporate units, overhead,
 * franchise contribution and platform gross profit on one page, with tax,
 * capex, the equity rounds and cumulative cash. The portfolio is computed
 * with the franchise unit counts so overhead roles that scale with them
 * (franchise support) are staffed. Franchise and platform profit are taxed
 * at the same pass-through rate as the units.
 */
export function computeCompany(input: CompanyInput, options: PortfolioOptions = {}): CompanyModel {
  const { scenario, schedule, markets, franchiseTerms } = input;
  const years = options.years ?? 5;
  const franchiseUnitsByYear: Record<number, number> = {};
  let open = 0;
  for (let y = 1; y <= years; y++) {
    for (const m of markets) open += m.unitsByYear[y] ?? 0;
    franchiseUnitsByYear[y] = open;
  }
  const portfolio = computePortfolio(schedule, scenario, { ...options, years, franchiseUnitsByYear });
  const base = computeLocation(scenario.assumptions);
  const platform = computePlatform({
    corporate: portfolio.years.map((y) => ({ year: y.year, corporateRevenue: y.revenue, corporateLocationsAtEnd: y.locationsOpenAtEnd })),
    markets,
    terms: franchiseTerms,
    unitSteadyRevenue: base.annualRevenue,
    ramp: scenario.assumptions,
    techPlatformPct: scenario.assumptions.techPlatformPct,
  });
  const taxRate = options.taxDistributionRate ?? DEFAULT_TAX_DISTRIBUTION_RATE;
  const rows: CompanyYear[] = [];
  let cumulativeCash = 0;
  let minimumCash = Number.POSITIVE_INFINITY;
  let carry = 0;
  portfolio.years.forEach((p, i) => {
    const f = platform.years[i] as PlatformModel["years"][number];
    const franchiseAndPlatform = f.franchiseContribution + f.platformGrossProfit;
    const consolidatedEbitda = p.consolidatedEbitda + franchiseAndPlatform;
    const income = consolidatedEbitda - p.depreciation;
    let taxable = 0;
    if (income > 0) {
      taxable = Math.max(0, income - carry);
      carry = Math.max(0, carry - income);
    } else carry += -income;
    const taxDistributions = taxable * taxRate;
    // The portfolio's cash is corporate-only; rebuild it with the franchise and platform lines and the company-level tax.
    const freeCashFlow = consolidatedEbitda - taxDistributions - p.maintenanceCapex - p.growthCapex - p.investments;
    cumulativeCash += p.equityRaised + freeCashFlow;
    if (cumulativeCash < minimumCash) minimumCash = cumulativeCash;
    rows.push({
      year: p.year,
      corporateRevenue: p.revenue,
      companyRevenue: f.companyRevenue,
      systemWideSales: f.systemWideSales,
      corporateLocations: p.locationsOpenAtEnd,
      franchiseLocations: f.franchiseLocations,
      unitEbitda: p.ebitda,
      preOpeningExpense: p.preOpeningExpense,
      corporateOverhead: p.corporateOverhead,
      franchiseContribution: f.franchiseContribution,
      recurringFranchiseProfit: f.recurringFranchiseProfit,
      platformGrossProfit: f.platformGrossProfit,
      consolidatedEbitda,
      recurringEbitda: p.ebitda - p.corporateOverhead + f.recurringFranchiseProfit + f.platformGrossProfit,
      depreciation: p.depreciation,
      taxDistributions,
      maintenanceCapex: p.maintenanceCapex,
      growthCapex: p.growthCapex,
      investments: p.investments,
      equityRaised: p.equityRaised,
      freeCashFlow,
      cumulativeCash,
    });
  });
  return { portfolio, platform, years: rows, minimumCash: rows.length > 0 ? minimumCash : 0 };
}
