/**
 * Types for the Oh! Beef Noodle Soup financial engine.
 *
 * Everything here is plain data. The engine is deterministic functions over
 * these shapes (spec 5.1): no React, no Prisma, no I/O.
 */

export type ScenarioKey = "conservative" | "base" | "aggressive";

/** Capital lines that differ between the flagship and later units (spec 5.6). */
export interface CapexAssumptions {
  podUnitCost: number;
  kitchenEquipment: number;
  buildoutPerSqFt: number;
  tenantImprovementAllowancePerSqFt: number;
  techHardware: number;
  designArchPermits: number;
  ffeSignage: number;
  preOpening: number;
}

/**
 * Spec 5.3, implemented exactly, plus two levers the spec's tables cannot be
 * reproduced without:
 *
 *  - `annualHoursPerFTE`: 5.3 gives a wage but no hours. 1,850 reproduces the
 *    5.5 labor line ($537K, 12.8%); the CPA convention of 2,080 gives $582K
 *    (13.9%) and EBITDA 29.7%. Exposed as a lever so the owner can flip it.
 *  - `rampPlateau`: the index used after the 18-month ramp curve ends.
 */
export interface LocationAssumptions extends CapexAssumptions {
  // Physical
  pods: number;
  squareFeet: number;
  // Throughput
  serviceHoursPerDay: number;
  operatingDaysPerYear: number;
  avgDwellMinutes: number;
  turnoverMinutes: number;
  /** Primary lever. 0.22 / 0.30 / 0.40 across the three scenarios. */
  utilizationRate: number;
  // Revenue
  avgBowlPrice: number;
  addOnAttachRate: number;
  avgAddOnSpend: number;
  beverageAttachRate: number;
  avgBeverageSpend: number;
  retailAttachRate: number;
  avgRetailSpend: number;
  // Cost of sales
  foodCostPct: number;
  packagingPct: number;
  // Labor (the thesis)
  kitchenFTE: number;
  managerFTE: number;
  avgKitchenWage: number;
  avgManagerSalary: number;
  payrollBurdenPct: number;
  annualHoursPerFTE: number;
  // Occupancy
  rentPerSqFtAnnual: number;
  nnnPerSqFtAnnual: number;
  // Other operating
  utilitiesPct: number;
  paymentProcessingPct: number;
  marketingPct: number;
  techPlatformPct: number;
  suppliesPct: number;
  repairsMaintPct: number;
  insuranceAnnual: number;
  gaPct: number;
  contingencyPct: number;
  // Ramp (index vs steady state, month 1..N)
  rampCurve: readonly number[];
  rampPlateau: number;
}

export interface Scenario {
  key: ScenarioKey;
  assumptions: LocationAssumptions;
  /** Capex lines that change for locations 2 to 5 (spec 5.6, "learning curve"). */
  subsequentUnitOverrides: Readonly<Partial<CapexAssumptions>>;
}

export type CostLineKey =
  | "foodCost"
  | "packaging"
  | "labor"
  | "occupancy"
  | "utilities"
  | "paymentProcessing"
  | "marketing"
  | "techPlatform"
  | "supplies"
  | "repairsMaint"
  | "insurance"
  | "ga"
  | "contingency";

export interface CostLine {
  key: CostLineKey;
  amount: number;
  /** Share of annual revenue, 0..1. */
  pct: number;
  /** True for lines that do not scale with revenue (labor, occupancy, insurance). */
  fixed: boolean;
  /** Cost of sales (above gross profit) vs operating expense. */
  group: "cogs" | "opex";
}

export interface LocationModel {
  // Throughput
  cycleMinutes: number;
  turnsPerPodPerDay: number;
  theoreticalCoversPerDay: number;
  actualCoversPerDay: number;
  // Revenue
  avgCheck: number;
  dailyRevenue: number;
  annualRevenue: number;
  revenuePerSqFt: number;
  // Cost of sales
  foodCost: number;
  packaging: number;
  grossProfit: number;
  grossMarginPct: number;
  // Operating expenses
  labor: number;
  laborPct: number;
  occupancy: number;
  utilities: number;
  paymentProcessing: number;
  marketing: number;
  techPlatform: number;
  supplies: number;
  repairsMaint: number;
  insurance: number;
  ga: number;
  contingency: number;
  totalOpex: number;
  totalOpexPct: number;
  // Result
  ebitda: number;
  ebitdaMarginPct: number;
  // Break-even
  fixedCosts: number;
  variableCostPct: number;
  breakEvenRevenue: number;
  breakEvenCoversPerDay: number;
  /** Ordered as the waterfall renders them: cogs first, then opex. */
  lines: readonly CostLine[];
}

export interface LoanAssumptions {
  principal: number;
  termMonths: number;
  /** Nominal annual rate, e.g. 0.06. Monthly amortizing. */
  annualRate: number;
}

export interface DebtServiceModel {
  monthlyPayment: number;
  annualDebtService: number;
  totalPaid: number;
  totalInterest: number;
}

export interface CapexLine {
  key: keyof CapexAssumptions;
  amount: number;
}

export interface CapexModel {
  lines: readonly CapexLine[];
  /** Sum of every line; the TI allowance is negative. */
  total: number;
}

export interface RampMonth {
  /** 1-based month from opening. */
  month: number;
  index: number;
  revenue: number;
  ebitda: number;
  debtService: number;
  leveredCashFlow: number;
  cumulativeLeveredCashFlow: number;
}

export interface RampYear {
  year: number;
  revenue: number;
  ebitda: number;
  leveredCashFlow: number;
}

export interface PaybackModel {
  /** Capex divided by steady-state (EBITDA minus debt service). How a lender reads payback. */
  fromStabilization: number | null;
  /** Years from opening until cumulative levered cash flow through the ramp repays capex. How an investor reads it. */
  fromOpening: number | null;
}

export interface RampModel {
  months: readonly RampMonth[];
  years: readonly RampYear[];
  payback: PaybackModel;
}

/** One location's complete story, for the Model and Unit Economics modules. */
export interface UnitModel {
  scenario: ScenarioKey;
  flagship: boolean;
  location: LocationModel;
  capex: CapexModel;
  debt: DebtServiceModel;
  dscr: number | null;
  ramp: RampModel;
}

export type LocationStructure = "corporate" | "jv" | "master-franchise" | "sub-franchise";

export interface OpeningPlan {
  key: string;
  name: string;
  region: "utah" | "us-metro";
  /** Months after the flagship opens (T0 = 0), so the plan never goes stale. */
  openMonth: number;
  flagship: boolean;
  structure: LocationStructure;
  /** Market-specific tweaks (rent, utilization, pricing) applied on top of the scenario. */
  overrides?: Readonly<Partial<LocationAssumptions>>;
}

export interface PortfolioLocation {
  key: string;
  name: string;
  openMonth: number;
  flagship: boolean;
  steadyRevenue: number;
  steadyEbitda: number;
  capex: number;
}

export interface PortfolioYear {
  year: number;
  /** Keys of locations that opened during this year. */
  openings: readonly string[];
  locationsOpenAtEnd: number;
  podsAtEnd: number;
  /** Steady-state covers per day across locations open at year end. */
  coversPerDayAtEnd: number;
  revenue: number;
  ebitda: number;
  /** Capex is booked in the opening month. */
  capexDeployed: number;
  cumulativeCapex: number;
}

export interface PortfolioModel {
  locations: readonly PortfolioLocation[];
  years: readonly PortfolioYear[];
}

export interface FranchiseTerms {
  unitFranchiseFee: number;
  royaltyPct: number;
  marketingFundPct: number;
  /** Oh! OS license per location per month. Charged to every location, corporate included, in the ARR headline. */
  platformLicenseMonthly: number;
  platformGrossMarginPct: number;
}

export interface FranchiseMarket {
  key: string;
  name: string;
  structure: LocationStructure;
  /** One-time master franchise territory fee, booked in `territoryYear`. */
  territoryFee: number;
  territoryYear: number;
  /** New franchise units opened in each plan year. */
  unitsByYear: Readonly<Record<number, number>>;
  /** Franchise unit steady revenue relative to the scenario's base unit. */
  auvIndex: number;
}

export interface PlatformYearInput {
  year: number;
  corporateRevenue: number;
  corporateLocationsAtEnd: number;
}

export interface PlatformYear {
  year: number;
  corporateLocations: number;
  franchiseLocations: number;
  systemLocations: number;
  /** platformLicenseMonthly × 12 × system locations. */
  licenseARR: number;
  /** techPlatformPct × corporate revenue. Internal; excluded from company revenue. */
  corporateTransfer: number;
  franchiseGrossSales: number;
  royalties: number;
  /** Pass-through; excluded from company revenue. */
  marketingFund: number;
  unitFees: number;
  territoryFees: number;
  /** License fees actually paid by franchisees (not corporate). */
  franchiseLicenseFees: number;
  /** Everything the platform unit books: transfer + all license fees. */
  platformRevenue: number;
  platformGrossProfit: number;
  /** Corporate restaurant revenue + franchise license + royalties + fees. What we can call "our" revenue. */
  companyRevenue: number;
  /** Corporate + franchisee gross sales. Never label this as company revenue. */
  systemWideSales: number;
}

export interface PlatformModel {
  years: readonly PlatformYear[];
}

export interface FundingSource {
  key: string;
  amount: number;
}

export interface UseOfFunds {
  key: string;
  amount: number;
}

export interface RoundAssumptions {
  key: string;
  sources: readonly FundingSource[];
  uses: readonly UseOfFunds[];
}

export interface CapitalStackModel {
  key: string;
  sources: readonly FundingSource[];
  uses: readonly UseOfFunds[];
  totalSources: number;
  totalUses: number;
  /** Sources minus uses; zero when the round balances. */
  unallocated: number;
}

export interface Owner {
  key: string;
  pct: number;
}

export interface DilutionModel {
  preMoneyValuation: number;
  newMoney: number;
  postMoneyValuation: number;
  newInvestorPct: number;
  owners: readonly { key: string; pctBefore: number; pctAfter: number }[];
}

/** Levers the UI exposes and that share links may override. */
export type LeverKey = Exclude<keyof LocationAssumptions, "rampCurve">;

export interface LeverBounds {
  min: number;
  max: number;
  step: number;
}

export interface SharedScenario {
  base: ScenarioKey;
  overrides: Readonly<Partial<Record<LeverKey, number>>>;
}

export type Currency = "USD" | "TWD" | "JPY" | "GBP" | "EUR" | "SGD" | "AUD";

export interface FxTable {
  /** ISO date. Rates are fixed and illustrative, never live (spec 7.4). */
  ratesAsOf: string;
  /** Units of currency per 1 USD. */
  rates: Readonly<Record<Currency, number>>;
}
