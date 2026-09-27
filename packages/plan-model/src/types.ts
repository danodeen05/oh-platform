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
  /** Pre-opening payroll, training, licenses and soft costs. Expensed in the consolidated P&L over `preOpeningMonths`. */
  preOpening: number;
  /** 2026-09-26: opening marketing budget (launch events, local media, member acquisition). Part of the capex total. */
  launchMarketing: number;
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
  /** Derived from `computeMenu` at preset-build time; still a lever. */
  foodCostPct: number;
  packagingPct: number;
  /** 2026-09-26 (finding C2): member program cost as a share of revenue: cashback, referral credits, challenges, perks at COGS. */
  memberProgramPct: number;
  /** 2026-09-26 (finding C2): fixed annual member-program spend (swag, VIP gifts, events, Wall of Fame). Enters fixed costs. */
  memberSwagAnnual: number;
  /** 2026-09-26 (finding R3): discounts, comps and remakes as a share of revenue. */
  discountsCompsPct: number;
  /** 2026-09-26 (finding R5): sales tax collected on top of menu prices. Revenue is net; processing is charged on the gross ticket. */
  salesTaxPct: number;
  // Labor (the thesis)
  /** Derived from `coverageToFTE(kitchenHoursPerDay, ...)` at preset-build time; still a lever (step 0.1). */
  kitchenFTE: number;
  /** 2026-09-26 (finding L1): scheduled kitchen and runner hours per operating day (see labor.ts COVERAGE_SCHEDULE). */
  kitchenHoursPerDay: number;
  /** 2026-09-26 (finding L1): uplift on scheduled hours for PTO, sick time and training coverage. */
  coverageFactorPct: number;
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
  /** 2026-09-27 (owner decision): charitable pledge to ONE RED STEP AT A TIME, a 501(c)(3) and a related party, as a share of revenue. Opex, not cost of sales. */
  communityGivingPct: number;
  // Escalation by plan year (2026-09-26, finding R6). Year 1 is unescalated.
  rentEscalationPct: number;
  wageInflationPct: number;
  cogsInflationPct: number;
  menuPriceGrowthPct: number;
  /** 2026-09-26 (finding K4): maintenance capex as a share of revenue from year 2 of a unit's life. */
  maintenanceCapexPct: number;
  /** 2026-09-26 (finding K5): months before opening over which the pre-opening line is expensed. 0 keeps it capitalized. */
  preOpeningMonths: number;
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
  | "memberProgram"
  | "discountsComps"
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
  | "contingency"
  | "communityGiving";

export interface CostLine {
  key: CostLineKey;
  amount: number;
  /** Share of annual revenue, 0..1. */
  pct: number;
  /** True for lines that do not scale with revenue (labor, occupancy, insurance). memberProgram carries a fixed part inside a variable line. */
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
  /** memberProgramPct × revenue + memberSwagAnnual. */
  memberProgram: number;
  discountsComps: number;
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
  /** communityGivingPct × revenue: the 1% pledge. */
  communityGiving: number;
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

/** One depreciable asset class of a unit's build (2026-09-26, finding K3). */
export interface DepreciationLine {
  key: keyof CapexAssumptions;
  /** Cost basis (buildout is net of the TI allowance). */
  basis: number;
  lifeYears: number;
  /** Straight-line charge per year while the asset is in service. */
  annual: number;
}

export interface DepreciationModel {
  lines: readonly DepreciationLine[];
  /** Total charge in a full first year. */
  annual: number;
  /** Charge by year of the unit's life, index 0 = year 1, through the longest life. */
  byYear: readonly number[];
}

export interface RampMonth {
  /** 1-based month from opening. */
  month: number;
  index: number;
  revenue: number;
  ebitda: number;
  debtService: number;
  /** EBITDA minus debt service (unchanged meaning). */
  leveredCashFlow: number;
  cumulativeLeveredCashFlow: number;
  /** maintenanceCapexPct × revenue from the unit's second year. */
  maintenanceCapex: number;
  /** leveredCashFlow minus maintenance capex. Drives payback from opening. */
  freeCashFlow: number;
  cumulativeFreeCashFlow: number;
}

export interface RampYear {
  year: number;
  revenue: number;
  ebitda: number;
  leveredCashFlow: number;
  maintenanceCapex: number;
  freeCashFlow: number;
}

export interface PaybackModel {
  /** Capex divided by steady-state (EBITDA minus debt service). How a lender reads payback. */
  fromStabilization: number | null;
  /** Years from opening until cumulative free cash flow (after maintenance capex) through the ramp repays net capex, which includes the pre-opening burn. How an investor reads it. */
  fromOpening: number | null;
}

export interface RampModel {
  months: readonly RampMonth[];
  years: readonly RampYear[];
  payback: PaybackModel;
  /** Pre-opening months (month -preOpeningMonths .. -1) carrying the pre-opening burn; empty when preOpeningMonths is 0. */
  preOpening: readonly RampMonth[];
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
  depreciation: DepreciationModel;
}

export type LocationStructure = "corporate" | "franchise" | "jv" | "master-franchise" | "sub-franchise";

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
  /** Unit-level (four-wall) EBITDA, before overhead and pre-opening. Unchanged meaning. */
  ebitda: number;
  /** Capex is booked in the opening month. Includes the pre-opening line. */
  capexDeployed: number;
  cumulativeCapex: number;
  /** 2026-09-26: pre-opening cost expensed over the months before each opening (booked in year 1 when it falls before T0). */
  preOpeningExpense: number;
  /** 2026-09-26: corporate overhead from overhead.ts (zero when the portfolio is computed without one). */
  corporateOverhead: number;
  /** ebitda − preOpeningExpense − corporateOverhead. */
  consolidatedEbitda: number;
  /** Straight-line depreciation of every open unit's build. */
  depreciation: number;
  /** Cash distributed to members for pass-through income tax: taxDistributionRate × taxable income after loss carryforward. */
  taxDistributions: number;
  maintenanceCapex: number;
  /** capexDeployed minus the pre-opening line that is expensed instead. */
  growthCapex: number;
  /** Capitalized investments outside unit capex this year (platform build, corporate infrastructure). */
  investments: number;
  /** Equity received this year (the rounds). */
  equityRaised: number;
  /** consolidatedEbitda − taxDistributions − maintenanceCapex − growthCapex − investments. */
  freeCashFlow: number;
  /** Prior balance + equityRaised + freeCashFlow. */
  cumulativeCash: number;
}

export interface PortfolioModel {
  locations: readonly PortfolioLocation[];
  years: readonly PortfolioYear[];
  /** Lowest year-end cumulative cash across the horizon. */
  minimumCash: number;
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
  /** One-time territory or area-development fee, booked in `territoryYear`. */
  territoryFee: number;
  territoryYear: number;
  /** New franchise units opened in each plan year. */
  unitsByYear: Readonly<Record<number, number>>;
  /** Franchise unit steady revenue relative to the scenario's base unit. */
  auvIndex: number;
  /** ISO currency the royalties are earned in. Anything but USD takes the structure's FX haircut. Default USD. */
  currency?: string;
}

/**
 * 2026-09-26 (finding F2): what each deal structure actually leaves the
 * brand. Shares are the brand's take of what the franchisee pays; costs are
 * what the brand spends to sell, enter, open and support.
 */
export interface StructureEconomics {
  /** Brand's share of the franchisee's royalty (a master keeps the rest). */
  royaltyShare: number;
  /** Brand's share of the unit franchise fee. */
  unitFeeShare: number;
  /** One-time cost to sign the market, booked in territoryYear. */
  salesCostPerMarket: number;
  /** Per-unit sales cost, booked when the unit opens. */
  salesCostPerUnit: number;
  /** One-time legal, registration and adaptation cost, booked in territoryYear. */
  entryCost: number;
  /** Opening support for the first unit in the market. */
  firstOpeningSupport: number;
  /** Opening support for every later unit in the market. */
  subsequentOpeningSupport: number;
  /** Recurring field support per open unit per year. */
  supportPerUnitPerYear: number;
  /** Haircut on royalties earned in a non-USD currency (conversion, withholding, timing). */
  fxHaircutPct: number;
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
  /** Royalties the franchisees pay, before the master's share and FX. */
  grossRoyalties: number;
  /** Royalties the brand receives: grossRoyalties × structure royaltyShare × (1 − FX haircut). */
  brandRoyalties: number;
  /**
   * 2026-09-26 semantic change: brand-received royalties (equal to brandRoyalties).
   * Before the re-baseline this was the gross figure, now in grossRoyalties.
   */
  royalties: number;
  /** Pass-through; excluded from company revenue. */
  marketingFund: number;
  /** Unit franchise fees paid by franchisees, before the master's share. */
  grossUnitFees: number;
  /** 2026-09-26 semantic change: brand-received unit fees (gross × unitFeeShare). */
  unitFees: number;
  territoryFees: number;
  /** Sales, entry, opening and per-unit support costs the brand spends on franchising this year. */
  franchiseSupportCost: number;
  /** royalties + unitFees + territoryFees − franchiseSupportCost. Includes one-time fees. */
  franchiseContribution: number;
  /** brand royalties − recurring per-unit support. The only franchise profit an acquirer capitalizes. */
  recurringFranchiseProfit: number;
  /** License fees actually paid by franchisees (not corporate). */
  franchiseLicenseFees: number;
  /** Everything the platform unit books: transfer + all license fees. */
  platformRevenue: number;
  platformGrossProfit: number;
  /** Corporate restaurant revenue + franchise license + brand royalties + brand fees. What we can call "our" revenue. */
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

export interface PartnershipTerms {
  founderKey: string;
  partnerKey: string;
  /** Founder cash in. Concept, platform and operating role are the rest of the founder's contribution. */
  founderCapital: number;
  /** Total partner equity across all rounds. */
  partnerCapital: number;
  /** Return the partner underwrites to, e.g. 3.0 for 3x. */
  targetMultiple: number;
  /** Plan year of the assumed exit or valuation event. */
  exitYear: number;
  /** Enterprise value as a multiple of exit-year EBITDA. */
  exitMultiple: number;
  /**
   * @deprecated 2026-09-26. Franchise profit now comes from STRUCTURE_ECONOMICS
   * (platform.ts). Kept so existing readers compile; the engine ignores it.
   */
  franchiseMarginPct: number;
  /** Typical operator stake when a partner funds all capital. */
  sweatEquityBenchmark: { min: number; max: number };
  /** Owner's hard ceiling on partner ownership, e.g. 0.49. The headline never exceeds it. */
  partnerPctCap: number;
  /** Share of post-tax free cash flow (2026-09-26; was corporate EBITDA) paid out to owners each year. */
  distributionPct: number;
  /** 2026-09-26: pass-through income tax rate funded by tax distributions. Default 0.37. */
  taxDistributionRate?: number;
  /** 2026-09-26: exit EBITDA excludes territory fees, unit fees and pre-opening. Default true. */
  recurringOnlyExit?: boolean;
  /** 2026-09-26: preferred return accruing on unreturned partner capital, simple, per year. Default 0.08. */
  preferredReturnPct?: number;
  /** 2026-09-26: liquidation preference as a multiple of partner capital, paid before common at the exit. Default 1. */
  liquidationPreference?: number;
  /** 2026-09-26: when the partner's capital arrives (plan year, 1 = the year the flagship opens). Default: all in year 1. */
  partnerCapitalSchedule?: readonly { year: number; amount: number }[];
}

/** 2026-09-26: the preferred-equity construct the owner asked for (8% pref, 1x liquidation preference, capped common). */
export interface PreferredConstruct {
  preferredReturnPct: number;
  liquidationPreference: number;
  /** Pref accrued through the exit year (simple interest on capital from the year after it is invested). */
  accruedPreference: number;
  /** Pref paid out of yearly distributions before common shares anything. */
  preferencePaidFromDistributions: number;
  /** Pref still unpaid at the exit, settled from exit proceeds. */
  preferencePaidAtExit: number;
  /** liquidationPreference × capital, settled from exit proceeds after the unpaid pref. */
  liquidationPaid: number;
  /** Exit value left for common after the preference stack. */
  residualExitValue: number;
  /** Distributions left for common after the pref. */
  commonDistributions: number;
  /** Common stake the return math implies once the preference stack is counted (0..1). */
  partnerCommonPctReturnBased: number;
  /** Rounded up to 5% and capped at partnerPctCap. */
  partnerCommonPct: number;
  cappedByOwner: boolean;
  founderCommonPct: number;
  partnerTotal: number;
  founderTotal: number;
  /** partnerTotal ÷ partner capital. */
  partnerMultiple: number;
}

export interface OwnershipModel {
  terms: PartnershipTerms;
  totalCapital: number;
  /**
   * 2026-09-26 semantic change: consolidated, recurring-only exit-year EBITDA:
   * unit EBITDA minus corporate overhead, plus recurring franchise profit and
   * platform gross profit. Territory fees, unit fees and pre-opening are out
   * (unless terms.recurringOnlyExit is false). Before the re-baseline this was
   * unit EBITDA with no overhead plus one-time fees.
   */
  exitEbitda: number;
  /** Unit-level (four-wall) corporate EBITDA in the exit year. */
  corporateEbitda: number;
  /** Corporate overhead in the exit year. */
  corporateOverhead: number;
  platformGrossProfit: number;
  /** Franchise profit counted in exitEbitda (recurring only by default). */
  franchiseContribution: number;
  /** Share of exitEbitda that is recurring franchise profit; gates the hybrid multiple. */
  recurringFranchiseShare: number;
  exitYear: number;
  /** Multiple actually applied (the hybrid multiple when requested and eligible). */
  exitMultiple: number;
  hybridEligible: boolean;
  exitValue: number;
  /** Sum of yearly owner distributions through the exit year. */
  totalDistributions: number;
  /** partnerCapital × targetMultiple. */
  requiredExitValue: number;
  /** requiredExitValue ÷ exitValue, clamped to 0..1. What the return math alone implies. */
  partnerPctReturnBased: number;
  /** Return-based figure rounded up to 5%, then capped at partnerPctCap. The headline. */
  partnerPct: number;
  /** True when the cap, not the return math, set the headline. */
  cappedByOwner: boolean;
  founderPct: number;
  /** Where the founder's residual sits against the sweat-equity benchmark. */
  founderVsBenchmark: "below" | "within" | "above";
  /** Partner's money-on-money multiple at the exit given partnerPct (distributions plus exit proceeds). Stated even when the cap binds. */
  partnerMultipleAtHeadline: number;
  /** Multiple the partner would need the headline stake to deliver; equals targetMultiple unless capped. */
  impliedMultipleAtCap: number;
  owners: readonly Owner[];
  /** The preferred-equity construct evaluated on the same cash flows. */
  preferred: PreferredConstruct;
}

/** What a given split means for each side, year by year and at the exit. */
export interface OwnershipImpactYear {
  year: number;
  /** Unit-level corporate EBITDA (unchanged meaning). */
  corporateEbitda: number;
  /** Consolidated EBITDA after overhead and pre-opening. */
  consolidatedEbitda: number;
  /** Post-tax free cash flow available to owners (portfolio FCF plus post-tax franchise and platform profit), floored at zero. */
  distributable: number;
  distributions: number;
  founderDistribution: number;
  partnerDistribution: number;
  cumulativePartnerReturn: number;
  /** cumulativePartnerReturn ÷ partner capital. */
  partnerMultipleToDate: number;
}

export interface OwnershipImpact {
  partnerPct: number;
  founderPct: number;
  targetMultiple: number;
  exitMultiple: number;
  years: readonly OwnershipImpactYear[];
  exitValue: number;
  founderExitProceeds: number;
  partnerExitProceeds: number;
  founderCumulativeDistributions: number;
  partnerCumulativeDistributions: number;
  /** Distributions plus exit proceeds. */
  founderTotal: number;
  partnerTotal: number;
  partnerMultipleAtExit: number;
  /** First plan year in which distributions alone reach the target, or null within the horizon. */
  targetYearFromDistributions: number | null;
  /**
   * The "option to get out": what the founder pays at the exit year to buy the
   * partner's stake such that the partner's total (distributions received plus
   * the payment) equals targetMultiple × capital. Zero when distributions
   * already cleared the target.
   */
  buyoutAtTarget: number;
  /** buyoutAtTarget as a multiple of the partner's exit-value share; below 1 means the buyout is cheaper than the market stake. */
  buyoutVsMarket: number;
}

export interface DilutionModel {
  preMoneyValuation: number;
  newMoney: number;
  postMoneyValuation: number;
  newInvestorPct: number;
  owners: readonly { key: string; pctBefore: number; pctAfter: number }[];
}

/** One bowl on the menu: price, mix share and the cooked protein portion (2026-09-26, finding R2 and C1). */
export interface MenuBowl {
  key: "classic" | "wagyu" | "noBeef";
  price: number;
  /** Share of bowls sold. The three shares sum to 1. */
  mix: number;
  /** Cooked protein per bowl, ounces. */
  cookedOz: number;
  /** Raw protein cost, USD per pound. */
  rawCostPerLb: number;
}

export interface MenuAssumptions {
  classicPrice: number;
  wagyuPrice: number;
  noBeefPrice: number;
  classicMix: number;
  wagyuMix: number;
  noBeefMix: number;
  /** USDA Prime brisket or chuck, raw, USD per pound. */
  primeCostPerLb: number;
  /** American Wagyu brisket, raw, USD per pound. */
  wagyuCostPerLb: number;
  /** Cooked weight as a share of raw weight after trim, smoke and braise. */
  cookedYield: number;
  /** Cooked protein per Classic bowl, ounces. */
  primePortionOz: number;
  /** Cooked protein per Wagyu bowl, ounces. */
  wagyuPortionOz: number;
  /** Broth, noodles, vegetables, garnish and condiments per bowl. */
  baseBowlCost: number;
  addOnAttachRate: number;
  avgAddOnSpend: number;
  addOnCogsPct: number;
  beverageAttachRate: number;
  avgBeverageSpend: number;
  beverageCogsPct: number;
  retailAttachRate: number;
  avgRetailSpend: number;
  retailCogsPct: number;
  /** Waste, shrink and remakes on top of the recipe cost. */
  wastePct: number;
}

export interface MenuBowlCost {
  key: MenuBowl["key"];
  price: number;
  mix: number;
  proteinCost: number;
  foodCost: number;
  /** foodCost ÷ price. */
  foodCostPct: number;
}

export interface MenuModel {
  bowls: readonly MenuBowlCost[];
  /** Mix-weighted bowl price; the engine's avgBowlPrice. */
  blendedBowlPrice: number;
  /** Mix-weighted protein cost per bowl. */
  proteinCostPerBowl: number;
  /** Mix-weighted recipe cost per bowl before waste. */
  bowlFoodCost: number;
  addOnRevenue: number;
  beverageRevenue: number;
  retailRevenue: number;
  /** blendedBowlPrice + attach-weighted add-on, beverage and retail spend; the engine's average check. */
  check: number;
  /** All food cost per cover including waste. */
  cogsPerCover: number;
  /** cogsPerCover ÷ check; the engine's foodCostPct. */
  foodCostPct: number;
}

/** One corporate role or cost line in overhead.ts (2026-09-26, finding K1). */
export interface OverheadRole {
  key: string;
  title: string;
  /** Fully loaded before burden for salaried roles; the line amount for fees and other. */
  annual: number;
  /** Plan month the role starts (may be negative for pre-opening hires). */
  startMonth: number;
  /** Plan month the role ends (exclusive). Open-ended when omitted. */
  endMonth?: number;
  /** "salary" takes the payroll burden; "fees" and "other" do not. */
  kind: "salary" | "fees" | "other";
  /** Headcount or line multiplier for a year given the units on the ground. Default 1. */
  count?: (year: number, corporateUnits: number, franchiseUnits: number) => number;
  /** One-time in a specific plan year (e.g. the FDD build). */
  onlyYear?: number;
}

export interface CorporateOverheadAssumptions {
  key: "full" | "lean";
  roles: readonly OverheadRole[];
  payrollBurdenPct: number;
}

export interface OverheadLine {
  key: string;
  title: string;
  kind: OverheadRole["kind"];
  headcount: number;
  amount: number;
}

export interface OverheadYear {
  year: number;
  lines: readonly OverheadLine[];
  salaries: number;
  burden: number;
  fees: number;
  other: number;
  total: number;
  headcount: number;
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
