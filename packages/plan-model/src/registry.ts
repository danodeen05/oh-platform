import {
  FRANCHISE_MARKETS,
  FRANCHISE_TERMS,
  FX_RATES,
  NO_DEBT,
  OPENING_SCHEDULE,
  PARTNERSHIP_TERMS,
  ROUND_ONE,
  ROUND_TWO,
  SCENARIOS,
  SUBSEQUENT_UNIT_OVERRIDES,
} from "./assumptions/index";
import { MODEL_CHANGELOG } from "./changelog";
import { MENU_BASE, MENU_CURRENT_PRICES } from "./menu";
import { CORPORATE_OVERHEAD } from "./overhead";
import { STRUCTURE_ECONOMICS } from "./platform";
import type {
  CapexAssumptions,
  CorporateOverheadAssumptions,
  Currency,
  FranchiseMarket,
  FranchiseTerms,
  FxTable,
  LoanAssumptions,
  LocationAssumptions,
  LocationStructure,
  MenuAssumptions,
  OpeningPlan,
  PartnershipTerms,
  RoundAssumptions,
  ScenarioKey,
  StructureEconomics,
} from "./types";

/**
 * Assumptions register (2026-09-26, Model integrity section). Every
 * assumption the engine reads has an entry: where it came from, when, how
 * confident we are, whether it is a lever, and a live reader so the page
 * never shows a stale copy. The register is a Record over every key of the
 * assumption interfaces, so adding a field without registering it fails
 * typecheck; the dynamic groups (schedule, markets, structures, overhead,
 * rounds) are completed at runtime and checked by test.
 */
export type SourceKind = "spec" | "owner-decision" | "public-benchmark" | "engine-assumption" | "supplier-quote";
export type Confidence = "high" | "medium" | "low";
export type RegistryGroup =
  | "physical"
  | "throughput"
  | "revenue"
  | "menu"
  | "cogs"
  | "labor"
  | "occupancy"
  | "otherOpex"
  | "escalation"
  | "ramp"
  | "capexFlagship"
  | "capexSubsequent"
  | "schedule"
  | "franchise"
  | "structures"
  | "franchiseMarkets"
  | "overhead"
  | "partnership"
  | "rounds"
  | "loan"
  | "fx";
export type RegistryUnit =
  | "usd"
  | "usdPerYear"
  | "usdPerMonth"
  | "usdPerHour"
  | "usdPerSqFt"
  | "usdPerLb"
  | "pct"
  | "count"
  | "hours"
  | "days"
  | "minutes"
  | "months"
  | "years"
  | "oz"
  | "index"
  | "multiple"
  | "ratio"
  | "flag"
  | "text";

export interface RegistrySource {
  kind: SourceKind;
  /** One line: the document, decision, benchmark or quote. */
  detail: string;
  /** ISO date the value was last set or verified. */
  asOf: string;
  confidence: Confidence;
}

export type RegistryValue = number | string | boolean;

export interface RegistryContext {
  scenarioKey: ScenarioKey;
  assumptions: LocationAssumptions;
  menu: MenuAssumptions;
  subsequent: Readonly<Partial<CapexAssumptions>>;
  franchiseTerms: FranchiseTerms;
  partnership: PartnershipTerms;
  loan: LoanAssumptions;
  fx: FxTable;
  schedule: readonly OpeningPlan[];
  markets: readonly FranchiseMarket[];
  structures: Readonly<Record<LocationStructure, StructureEconomics>>;
  overhead: CorporateOverheadAssumptions;
  rounds: readonly RoundAssumptions[];
}

export interface RegistryEntry {
  group: RegistryGroup;
  label: string;
  unit: RegistryUnit;
  source: RegistrySource;
  /** True when the field is a slider the UI exposes. */
  lever: boolean;
  read: (ctx: RegistryContext) => RegistryValue;
}

type Prefixed<P extends string, T> = { [K in keyof T & string as `${P}.${K}`]: RegistryEntry };

export type RegistryKey = keyof (Prefixed<"unit", LocationAssumptions> &
  Prefixed<"menu", MenuAssumptions> &
  Prefixed<"capexSubsequent", CapexAssumptions> &
  Prefixed<"franchise", FranchiseTerms> &
  Prefixed<"partnership", PartnershipTerms> &
  Prefixed<"loan", LoanAssumptions> &
  Prefixed<"fx", Record<Currency, number>>);

const SPEC = "2026-09-25";
const REBASE = "2026-09-26";

function e(group: RegistryGroup, label: string, unit: RegistryUnit, kind: SourceKind, detail: string, asOf: string, confidence: Confidence, lever: boolean, read: RegistryEntry["read"]): RegistryEntry {
  return { group, label, unit, source: { kind, detail, asOf, confidence }, lever, read };
}
const unit = (group: RegistryGroup, key: keyof LocationAssumptions, label: string, u: RegistryUnit, kind: SourceKind, detail: string, asOf: string, confidence: Confidence): RegistryEntry =>
  e(group, label, u, kind, detail, asOf, confidence, key !== "rampCurve", (c) => (key === "rampCurve" ? c.assumptions.rampCurve.join(", ") : c.assumptions[key]));
const menu = (key: keyof MenuAssumptions, label: string, u: RegistryUnit, kind: SourceKind, detail: string, confidence: Confidence): RegistryEntry =>
  e("menu", label, u, kind, detail, REBASE, confidence, false, (c) => c.menu[key]);
const sub = (key: keyof CapexAssumptions, label: string, u: RegistryUnit, detail: string): RegistryEntry =>
  e("capexSubsequent", label, u, "spec", detail, SPEC, "medium", false, (c) => c.subsequent[key] ?? c.assumptions[key]);
const fr = (key: keyof FranchiseTerms, label: string, u: RegistryUnit, kind: SourceKind, detail: string, asOf: string, confidence: Confidence): RegistryEntry =>
  e("franchise", label, u, kind, detail, asOf, confidence, false, (c) => c.franchiseTerms[key]);
const loan = (key: keyof LoanAssumptions, label: string, u: RegistryUnit): RegistryEntry =>
  e("loan", label, u, "owner-decision", "No SBA loan (owner decision 2026-09-25); the reference loan is a lender lever", SPEC, "high", false, (c) => c.loan[key]);
const fx = (key: Currency): RegistryEntry =>
  e("fx", `${key} per USD`, "ratio", "engine-assumption", "Fixed illustrative rate (spec 7.4), never live", "2026-09-01", "medium", false, (c) => c.fx.rates[key]);

export const ASSUMPTION_REGISTRY: Readonly<Record<RegistryKey, RegistryEntry>> = Object.freeze({
  // Physical
  "unit.pods": unit("physical", "pods", "Pods", "count", "owner-decision", "75-pod / 3,500 sf standard footprint (DECISIONS.md, Sep 2026)", SPEC, "high"),
  "unit.squareFeet": unit("physical", "squareFeet", "Square feet", "count", "owner-decision", "75-pod / 3,500 sf standard footprint", SPEC, "high"),
  // Throughput
  "unit.serviceHoursPerDay": unit("throughput", "serviceHoursPerDay", "Service hours per day", "hours", "spec", "Spec 5.3", SPEC, "high"),
  "unit.operatingDaysPerYear": unit("throughput", "operatingDaysPerYear", "Operating days per year", "days", "owner-decision", "Closed Sundays: 313 days (owner decision 2026-09-26, finding R1; was 355)", REBASE, "high"),
  "unit.avgDwellMinutes": unit("throughput", "avgDwellMinutes", "Average dwell", "minutes", "spec", "Spec 5.3; verified against the kiosk flow", SPEC, "medium"),
  "unit.turnoverMinutes": unit("throughput", "turnoverMinutes", "Pod turnover", "minutes", "spec", "Spec 5.3; runner reset time, untested at 75 pods", SPEC, "low"),
  "unit.utilizationRate": unit("throughput", "utilizationRate", "Utilization", "pct", "spec", "Spec 5.4: 22% / 30% / 40%; the primary lever, no operating history", SPEC, "low"),
  // Revenue
  "unit.avgBowlPrice": unit("revenue", "avgBowlPrice", "Blended bowl price", "usd", "owner-decision", "computeMenu(MENU_BASE): $17.99 / $27.99 / $12.99 at a 68 / 20 / 12 mix (menu reset, owner decision 2026-09-26)", REBASE, "medium"),
  "unit.addOnAttachRate": unit("revenue", "addOnAttachRate", "Add-on attach rate", "pct", "engine-assumption", "Re-derived from the live menu (finding R2); no sales history", REBASE, "low"),
  "unit.avgAddOnSpend": unit("revenue", "avgAddOnSpend", "Average add-on spend", "usd", "engine-assumption", "Mix of $1.99 to $5.99 add-ons on the live menu (finding R2)", REBASE, "medium"),
  "unit.beverageAttachRate": unit("revenue", "beverageAttachRate", "Beverage attach rate", "pct", "engine-assumption", "Free water on the menu; 40% take a $2.49 drink (finding R2)", REBASE, "low"),
  "unit.avgBeverageSpend": unit("revenue", "avgBeverageSpend", "Average beverage spend", "usd", "engine-assumption", "$2.49 soda on the live menu (finding R2)", REBASE, "high"),
  "unit.retailAttachRate": unit("revenue", "retailAttachRate", "Retail attach rate", "pct", "spec", "Spec 5.3 with DECISIONS.md item 1 (0.025)", SPEC, "low"),
  "unit.avgRetailSpend": unit("revenue", "avgRetailSpend", "Average retail spend", "usd", "spec", "Spec 5.3", SPEC, "low"),
  // Cost of sales
  "unit.foodCostPct": unit("cogs", "foodCostPct", "Food cost", "pct", "public-benchmark", "computeMenu(MENU_BASE): bowl-level build with Prime and American Wagyu at public price ranges (finding C1); supplier quotes open", REBASE, "medium"),
  "unit.packagingPct": unit("cogs", "packagingPct", "Packaging", "pct", "spec", "Spec 5.3", SPEC, "medium"),
  "unit.memberProgramPct": unit("cogs", "memberProgramPct", "Member program (variable)", "pct", "engine-assumption", "Recommended program design: 1 to 3% cashback, $5 + $5 referrals on first order, challenges, perks at COGS (finding C2)", REBASE, "medium"),
  "unit.memberSwagAnnual": unit("cogs", "memberSwagAnnual", "Member program (fixed)", "usdPerYear", "engine-assumption", "Swag, VIP gifts, events, Wall of Fame (finding C2)", REBASE, "medium"),
  "unit.discountsCompsPct": unit("cogs", "discountsCompsPct", "Discounts, comps and remakes", "pct", "public-benchmark", "Fast-casual 1% to 2% of sales (finding R3)", REBASE, "medium"),
  "unit.salesTaxPct": unit("cogs", "salesTaxPct", "Sales tax on the ticket", "pct", "public-benchmark", "Utah County combined rate; prices are tax-exclusive, revenue is net, processing is on the gross ticket (finding R5)", REBASE, "high"),
  // Labor
  "unit.kitchenFTE": unit("labor", "kitchenFTE", "Kitchen and runner FTE", "count", "engine-assumption", "coverageFTE(75 h/day × 313 days × 1.04 ÷ 2,080) from labor.ts COVERAGE_SCHEDULE (finding L1; was 7)", REBASE, "medium"),
  "unit.kitchenHoursPerDay": unit("labor", "kitchenHoursPerDay", "Scheduled kitchen hours per day", "hours", "engine-assumption", "The Operations page's own schedule summed: 75 hours (finding L1)", REBASE, "medium"),
  "unit.coverageFactorPct": unit("labor", "coverageFactorPct", "Coverage uplift", "pct", "public-benchmark", "PTO, sick and training coverage, 4% (finding L1)", REBASE, "medium"),
  "unit.managerFTE": unit("labor", "managerFTE", "Salaried managers", "count", "spec", "Spec 5.3: GM and AGM", SPEC, "high"),
  "unit.avgKitchenWage": unit("labor", "avgKitchenWage", "Blended kitchen wage", "usdPerHour", "public-benchmark", "Utah County market by role, 2026 (finding L3; was $24)", REBASE, "medium"),
  "unit.avgManagerSalary": unit("labor", "avgManagerSalary", "Average manager salary", "usdPerYear", "public-benchmark", "GM $70K, AGM $57K (finding L3; was $72K)", REBASE, "medium"),
  "unit.payrollBurdenPct": unit("labor", "payrollBurdenPct", "Payroll burden", "pct", "public-benchmark", "Taxes, workers' comp and health benefits for a salaried no-tip team (finding L2; was 18%)", REBASE, "medium"),
  "unit.annualHoursPerFTE": unit("labor", "annualHoursPerFTE", "Hours per FTE", "hours", "owner-decision", "CPA convention 2,080 (DECISIONS.md item 17)", SPEC, "high"),
  // Occupancy
  "unit.rentPerSqFtAnnual": unit("occupancy", "rentPerSqFtAnnual", "Base rent", "usdPerSqFt", "spec", "Spec 5.3; lease LOI open", SPEC, "medium"),
  "unit.nnnPerSqFtAnnual": unit("occupancy", "nnnPerSqFtAnnual", "NNN", "usdPerSqFt", "spec", "Spec 5.3", SPEC, "medium"),
  // Other operating
  "unit.utilitiesPct": unit("otherOpex", "utilitiesPct", "Utilities", "pct", "public-benchmark", "Fast-casual 2% to 3% (finding O4; was 3%)", REBASE, "medium"),
  "unit.paymentProcessingPct": unit("otherOpex", "paymentProcessingPct", "Card processing", "pct", "public-benchmark", "Card-only kiosks, 3.0% on the gross ticket (finding O3; was 2.7%)", REBASE, "high"),
  "unit.marketingPct": unit("otherOpex", "marketingPct", "Local marketing", "pct", "spec", "Spec 5.3; 1% pooled centrally as the brand fund", SPEC, "medium"),
  "unit.techPlatformPct": unit("otherOpex", "techPlatformPct", "Oh! OS transfer", "pct", "spec", "Spec 5.3 and 5.10; internal transfer to the platform unit", SPEC, "high"),
  "unit.suppliesPct": unit("otherOpex", "suppliesPct", "Supplies", "pct", "public-benchmark", "Fast-casual 1% to 2% (finding O4; was 2.2%)", REBASE, "medium"),
  "unit.repairsMaintPct": unit("otherOpex", "repairsMaintPct", "Repairs and maintenance", "pct", "spec", "Spec 5.3", SPEC, "medium"),
  "unit.insuranceAnnual": unit("otherOpex", "insuranceAnnual", "Insurance", "usdPerYear", "spec", "Spec 5.3; quotes open", SPEC, "medium"),
  "unit.gaPct": unit("otherOpex", "gaPct", "Unit G&A", "pct", "engine-assumption", "Unit-level only; corporate G&A moved to overhead.ts (finding O1; was 2.5%)", REBASE, "medium"),
  "unit.communityGivingPct": unit("otherOpex", "communityGivingPct", "Community giving pledge", "pct", "owner-decision", "1% of revenue to ONE RED STEP AT A TIME (501(c)(3), related party)", "2026-09-27", "high"),
  "unit.contingencyPct": unit("otherOpex", "contingencyPct", "Contingency", "pct", "engine-assumption", "Halved once the missing cost layers were modeled (finding O2)", REBASE, "medium"),
  // Escalation
  "unit.rentEscalationPct": unit("escalation", "rentEscalationPct", "Rent escalation", "pct", "public-benchmark", "Typical 3% annual bump (finding R6)", REBASE, "high"),
  "unit.wageInflationPct": unit("escalation", "wageInflationPct", "Wage inflation", "pct", "public-benchmark", "3.5% a year (finding R6)", REBASE, "medium"),
  "unit.cogsInflationPct": unit("escalation", "cogsInflationPct", "COGS inflation", "pct", "public-benchmark", "3% a year; beef is more volatile (finding R6)", REBASE, "low"),
  "unit.menuPriceGrowthPct": unit("escalation", "menuPriceGrowthPct", "Menu price growth", "pct", "engine-assumption", "2.5% a year, below cost inflation on purpose (finding R6)", REBASE, "medium"),
  "unit.maintenanceCapexPct": unit("escalation", "maintenanceCapexPct", "Maintenance capex", "pct", "public-benchmark", "1.5% of revenue from year 2 (finding K4)", REBASE, "medium"),
  "unit.preOpeningMonths": unit("escalation", "preOpeningMonths", "Pre-opening months", "months", "engine-assumption", "Pre-opening expensed over 3 months before opening (finding K5)", REBASE, "medium"),
  // Capex, flagship
  "unit.podUnitCost": unit("capexFlagship", "podUnitCost", "Pod unit cost", "usd", "spec", "Spec 5.6; fabrication quote open", SPEC, "low"),
  "unit.kitchenEquipment": unit("capexFlagship", "kitchenEquipment", "Kitchen equipment", "usd", "spec", "Spec 5.6", SPEC, "medium"),
  "unit.buildoutPerSqFt": unit("capexFlagship", "buildoutPerSqFt", "Buildout", "usdPerSqFt", "spec", "Spec 5.6", SPEC, "medium"),
  "unit.tenantImprovementAllowancePerSqFt": unit("capexFlagship", "tenantImprovementAllowancePerSqFt", "TI allowance", "usdPerSqFt", "spec", "Spec 5.6; lease LOI open", SPEC, "low"),
  "unit.techHardware": unit("capexFlagship", "techHardware", "Technology hardware", "usd", "spec", "Spec 5.6", SPEC, "medium"),
  "unit.designArchPermits": unit("capexFlagship", "designArchPermits", "Design, architecture and permits", "usd", "spec", "Spec 5.6", SPEC, "medium"),
  "unit.ffeSignage": unit("capexFlagship", "ffeSignage", "FF&E and signage", "usd", "spec", "Spec 5.6", SPEC, "medium"),
  "unit.preOpening": unit("capexFlagship", "preOpening", "Pre-opening", "usd", "engine-assumption", "Spec's $185K split into pre-opening $110K and launch marketing $75K (finding K5 / M1)", REBASE, "medium"),
  "unit.launchMarketing": unit("capexFlagship", "launchMarketing", "Launch marketing", "usd", "engine-assumption", "Opening budget carved from the spec's pre-opening line (finding M1)", REBASE, "medium"),
  // Ramp
  "unit.rampCurve": unit("ramp", "rampCurve", "Ramp curve (12 months)", "text", "engine-assumption", "Soft open at 70%, launch push, month 4 to 6 trough kept, steady state at month 12 (finding P1)", REBASE, "low"),
  "unit.rampPlateau": unit("ramp", "rampPlateau", "Ramp plateau", "index", "engine-assumption", "Steady state after month 12 (finding P1; was 1.06)", REBASE, "medium"),
  // Menu
  "menu.classicPrice": menu("classicPrice", "Classic bowl price", "usd", "owner-decision", "Menu reset (owner decision 2026-09-26)", "high"),
  "menu.wagyuPrice": menu("wagyuPrice", "Wagyu bowl price", "usd", "owner-decision", "Menu reset, 4.5 oz cooked (owner decision 2026-09-26)", "high"),
  "menu.noBeefPrice": menu("noBeefPrice", "No-beef bowl price", "usd", "owner-decision", "Menu reset (owner decision 2026-09-26)", "high"),
  "menu.classicMix": menu("classicMix", "Classic share of bowls", "pct", "engine-assumption", "No sales history; 68 / 20 / 12", "low"),
  "menu.wagyuMix": menu("wagyuMix", "Wagyu share of bowls", "pct", "engine-assumption", "No sales history", "low"),
  "menu.noBeefMix": menu("noBeefMix", "No-beef share of bowls", "pct", "engine-assumption", "No sales history", "low"),
  "menu.primeCostPerLb": menu("primeCostPerLb", "USDA Prime brisket, raw", "usdPerLb", "public-benchmark", "Wholesale boxed $5.50 to $7.00 per lb; supplier quote open", "medium"),
  "menu.wagyuCostPerLb": menu("wagyuCostPerLb", "American Wagyu brisket, raw", "usdPerLb", "public-benchmark", "Snake River Farms class, $9.00 to $13.00 per lb; supplier quote open", "medium"),
  "menu.cookedYield": menu("cookedYield", "Cooked yield", "pct", "public-benchmark", "Trim, smoke and braise loss on brisket, 50% to 60%", "medium"),
  "menu.primePortionOz": menu("primePortionOz", "Classic protein portion, cooked", "oz", "owner-decision", "Recipe", "high"),
  "menu.wagyuPortionOz": menu("wagyuPortionOz", "Wagyu protein portion, cooked", "oz", "owner-decision", "4.5 oz cooked (owner decision 2026-09-26)", "high"),
  "menu.baseBowlCost": menu("baseBowlCost", "Base bowl ex-protein", "usd", "engine-assumption", "Broth, noodles, vegetables, garnish; commissary costing open", "medium"),
  "menu.addOnAttachRate": menu("addOnAttachRate", "Add-on attach", "pct", "engine-assumption", "Finding R2", "low"),
  "menu.avgAddOnSpend": menu("avgAddOnSpend", "Add-on spend", "usd", "engine-assumption", "Finding R2", "medium"),
  "menu.addOnCogsPct": menu("addOnCogsPct", "Add-on COGS", "pct", "engine-assumption", "Protein-heavy add-ons at 33%", "medium"),
  "menu.beverageAttachRate": menu("beverageAttachRate", "Beverage attach", "pct", "engine-assumption", "Finding R2", "low"),
  "menu.avgBeverageSpend": menu("avgBeverageSpend", "Beverage spend", "usd", "engine-assumption", "$2.49 soda", "high"),
  "menu.beverageCogsPct": menu("beverageCogsPct", "Beverage COGS", "pct", "public-benchmark", "Bottled and fountain, 25% to 30%", "medium"),
  "menu.retailAttachRate": menu("retailAttachRate", "Retail attach", "pct", "spec", "Spec 5.3 with DECISIONS.md item 1", "low"),
  "menu.avgRetailSpend": menu("avgRetailSpend", "Retail spend", "usd", "spec", "Spec 5.3", "low"),
  "menu.retailCogsPct": menu("retailCogsPct", "Retail COGS", "pct", "engine-assumption", "Merchandise at 50%", "medium"),
  "menu.wastePct": menu("wastePct", "Waste and shrink", "pct", "public-benchmark", "2% on recipe cost", "medium"),
  // Capex, locations 2 to 5
  "capexSubsequent.podUnitCost": sub("podUnitCost", "Pod unit cost", "usd", "Spec 5.6: 15% tooling savings"),
  "capexSubsequent.kitchenEquipment": sub("kitchenEquipment", "Kitchen equipment", "usd", "Spec 5.6"),
  "capexSubsequent.buildoutPerSqFt": sub("buildoutPerSqFt", "Buildout", "usdPerSqFt", "Spec 5.6: learning curve"),
  "capexSubsequent.tenantImprovementAllowancePerSqFt": sub("tenantImprovementAllowancePerSqFt", "TI allowance", "usdPerSqFt", "Spec 5.6: unchanged"),
  "capexSubsequent.techHardware": sub("techHardware", "Technology hardware", "usd", "Spec 5.6"),
  "capexSubsequent.designArchPermits": sub("designArchPermits", "Design, architecture and permits", "usd", "Spec 5.6: prototype design carried by the flagship"),
  "capexSubsequent.ffeSignage": sub("ffeSignage", "FF&E and signage", "usd", "Spec 5.6"),
  "capexSubsequent.preOpening": sub("preOpening", "Pre-opening", "usd", "Spec's $140K split into $90K pre-opening and $50K launch marketing (2026-09-26)"),
  "capexSubsequent.launchMarketing": sub("launchMarketing", "Launch marketing", "usd", "Carved from the spec's pre-opening line (2026-09-26)"),
  // Franchise terms
  "franchise.unitFranchiseFee": fr("unitFranchiseFee", "Unit franchise fee", "usd", "spec", "Spec 5.9", SPEC, "medium"),
  "franchise.royaltyPct": fr("royaltyPct", "Royalty", "pct", "spec", "Spec 5.9; 4% to 6% is the fast-casual band", SPEC, "high"),
  "franchise.marketingFundPct": fr("marketingFundPct", "Marketing fund", "pct", "spec", "Spec 5.9; pass-through", SPEC, "high"),
  "franchise.platformLicenseMonthly": fr("platformLicenseMonthly", "Oh! OS license", "usdPerMonth", "spec", "Spec 5.10", SPEC, "medium"),
  "franchise.platformGrossMarginPct": fr("platformGrossMarginPct", "Platform gross margin", "pct", "spec", "Spec 5.10", SPEC, "medium"),
  // Partnership
  "partnership.founderKey": e("partnership", "Founder key", "text", "owner-decision", "Two-owner model (DECISIONS.md item 23)", SPEC, "high", false, (c) => c.partnership.founderKey),
  "partnership.partnerKey": e("partnership", "Partner key", "text", "owner-decision", "Two-owner model (DECISIONS.md item 23)", SPEC, "high", false, (c) => c.partnership.partnerKey),
  "partnership.founderCapital": e("partnership", "Founder capital", "usd", "owner-decision", "Round 1 founder contribution (DECISIONS.md item 20)", SPEC, "high", false, (c) => c.partnership.founderCapital),
  "partnership.partnerCapital": e("partnership", "Partner capital, all rounds", "usd", "owner-decision", "$3.0M + $7.5M (DECISIONS.md item 20)", SPEC, "high", false, (c) => c.partnership.partnerCapital),
  "partnership.targetMultiple": e("partnership", "Partner target multiple", "multiple", "public-benchmark", "3x over a 5-year hold, about 25% IRR (DECISIONS.md item 21)", SPEC, "medium", false, (c) => c.partnership.targetMultiple),
  "partnership.exitYear": e("partnership", "Exit year", "years", "owner-decision", "Year 5 headline; year 7 shown (owner decision 2026-09-26)", REBASE, "medium", false, (c) => c.partnership.exitYear),
  "partnership.exitMultiple": e("partnership", "Exit multiple", "multiple", "public-benchmark", "4x to 6x for small multi-unit operators; 6x hybrid when recurring franchise profit clears 25% of EBITDA", SPEC, "low", false, (c) => c.partnership.exitMultiple),
  "partnership.franchiseMarginPct": e("partnership", "Franchise margin (deprecated)", "pct", "engine-assumption", "Replaced by STRUCTURE_ECONOMICS on 2026-09-26; ignored by the engine", REBASE, "high", false, (c) => c.partnership.franchiseMarginPct),
  "partnership.sweatEquityBenchmark": e("partnership", "Sweat-equity benchmark", "text", "public-benchmark", "Operator keeps 25% to 40% when a partner funds all capital", SPEC, "medium", false, (c) => `${c.partnership.sweatEquityBenchmark.min} to ${c.partnership.sweatEquityBenchmark.max}`),
  "partnership.partnerPctCap": e("partnership", "Partner ownership cap", "pct", "owner-decision", "Founder keeps control (DECISIONS.md item 24)", SPEC, "high", false, (c) => c.partnership.partnerPctCap),
  "partnership.distributionPct": e("partnership", "Distribution share of free cash flow", "pct", "engine-assumption", "Half of post-tax free cash flow paid out (2026-09-26; was half of unit EBITDA)", REBASE, "medium", false, (c) => c.partnership.distributionPct),
  "partnership.taxDistributionRate": e("partnership", "Tax distribution rate", "pct", "public-benchmark", "Pass-through LLC; top federal plus Utah, about 37% (finding K6)", REBASE, "medium", false, (c) => c.partnership.taxDistributionRate ?? 0.37),
  "partnership.recurringOnlyExit": e("partnership", "Recurring-only exit EBITDA", "flag", "engine-assumption", "Territory and unit fees are not capitalized (finding F4)", REBASE, "high", false, (c) => c.partnership.recurringOnlyExit ?? true),
  "partnership.preferredReturnPct": e("partnership", "Preferred return", "pct", "owner-decision", "8% simple pref (owner decision 2026-09-26)", REBASE, "high", false, (c) => c.partnership.preferredReturnPct ?? 0.08),
  "partnership.liquidationPreference": e("partnership", "Liquidation preference", "multiple", "owner-decision", "1x (owner decision 2026-09-26)", REBASE, "high", false, (c) => c.partnership.liquidationPreference ?? 1),
  "partnership.partnerCapitalSchedule": e("partnership", "Partner capital by year", "text", "owner-decision", "Round 1 in year 1, round 2 in year 2 (DECISIONS.md item 20)", REBASE, "high", false, (c) => (c.partnership.partnerCapitalSchedule ?? []).map((t) => `Y${t.year}: ${t.amount}`).join("; ")),
  // Loan
  "loan.principal": loan("principal", "Loan principal", "usd"),
  "loan.termMonths": loan("termMonths", "Loan term", "months"),
  "loan.annualRate": loan("annualRate", "Loan rate", "pct"),
  // FX
  "fx.USD": fx("USD"),
  "fx.TWD": fx("TWD"),
  "fx.JPY": fx("JPY"),
  "fx.GBP": fx("GBP"),
  "fx.EUR": fx("EUR"),
  "fx.SGD": fx("SGD"),
  "fx.AUD": fx("AUD"),
});

export const REGISTRY_KEYS: readonly RegistryKey[] = Object.freeze(Object.keys(ASSUMPTION_REGISTRY) as RegistryKey[]);

/** Default context: the live presets for a scenario. */
export function registryContext(scenarioKey: ScenarioKey = "base"): RegistryContext {
  return {
    scenarioKey,
    assumptions: SCENARIOS[scenarioKey].assumptions,
    menu: scenarioKey === "conservative" ? MENU_CURRENT_PRICES : MENU_BASE,
    subsequent: SUBSEQUENT_UNIT_OVERRIDES,
    franchiseTerms: FRANCHISE_TERMS,
    partnership: PARTNERSHIP_TERMS,
    loan: NO_DEBT,
    fx: FX_RATES,
    schedule: OPENING_SCHEDULE,
    markets: FRANCHISE_MARKETS,
    structures: STRUCTURE_ECONOMICS,
    overhead: CORPORATE_OVERHEAD,
    rounds: [ROUND_ONE, ROUND_TWO],
  };
}

export interface RegistryRow extends RegistryEntry {
  key: string;
  value: RegistryValue;
  /** Plain token for deep links: `a-` plus the kebab-cased key. */
  anchor: string;
  /** Change-log dates that touched this key, newest first. */
  changedIn: readonly string[];
}

/** `unit.avgBowlPrice` -> `a-unit-avg-bowl-price`. Always matches /^[a-z][a-z0-9-]*$/. */
export function registryAnchor(key: string): string {
  const kebab = key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
  return `a-${kebab}`;
}

const STRUCTURE_FIELD_LABELS: Readonly<Record<keyof StructureEconomics, [string, RegistryUnit]>> = Object.freeze({
  royaltyShare: ["Brand share of royalty", "pct"],
  unitFeeShare: ["Brand share of unit fee", "pct"],
  salesCostPerMarket: ["Sales cost per market", "usd"],
  salesCostPerUnit: ["Sales cost per unit", "usd"],
  entryCost: ["Entry cost", "usd"],
  firstOpeningSupport: ["First opening support", "usd"],
  subsequentOpeningSupport: ["Later opening support", "usd"],
  supportPerUnitPerYear: ["Support per unit per year", "usdPerYear"],
  fxHaircutPct: ["FX haircut", "pct"],
});

/** The dynamic groups: schedule, markets, structures, overhead roles and rounds. Completed at runtime from the context. */
export function dynamicRegistryEntries(ctx: RegistryContext): readonly (RegistryEntry & { key: string })[] {
  const out: (RegistryEntry & { key: string })[] = [];
  for (const plan of ctx.schedule) {
    out.push({ key: `schedule.${plan.key}.openMonth`, ...e("schedule", `${plan.name}: opening month`, "months", "owner-decision", "T0+0/16/19/22/25 (DECISIONS.md item 18)", SPEC, "medium", false, () => plan.openMonth) });
  }
  for (const m of ctx.markets) {
    const detail = m.territoryYear >= 8 ? "Wave two: on the map from year 8 (owner decision 2026-09-26)" : "Phased schedule: 7 units in 5 markets by year 5, 15 by year 6, 27 by year 7 (owner decision 2026-09-26)";
    out.push({ key: `market.${m.key}.structure`, ...e("franchiseMarkets", `${m.name}: structure`, "text", "owner-decision", "JVs converted to master franchises (owner decision 2026-09-26)", REBASE, "high", false, () => m.structure) });
    out.push({ key: `market.${m.key}.territoryFee`, ...e("franchiseMarkets", `${m.name}: territory fee`, "usd", "spec", "Spec 5.9 range $250K to $750K; US metros $100K development fee", SPEC, "low", false, () => m.territoryFee) });
    out.push({ key: `market.${m.key}.territoryYear`, ...e("franchiseMarkets", `${m.name}: signed in year`, "years", "owner-decision", detail, REBASE, "low", false, () => m.territoryYear) });
    out.push({ key: `market.${m.key}.unitsByYear`, ...e("franchiseMarkets", `${m.name}: units by year`, "text", "owner-decision", detail, REBASE, "low", false, () => Object.entries(m.unitsByYear).map(([y, n]) => `Y${y}: ${n}`).join("; ")) });
    out.push({ key: `market.${m.key}.auvIndex`, ...e("franchiseMarkets", `${m.name}: AUV index`, "index", "engine-assumption", "Relative to the base unit; no market data", SPEC, "low", false, () => m.auvIndex) });
  }
  for (const [structure, econ] of Object.entries(ctx.structures) as [LocationStructure, StructureEconomics][]) {
    for (const [field, [label, u]] of Object.entries(STRUCTURE_FIELD_LABELS) as [keyof StructureEconomics, [string, RegistryUnit]][]) {
      out.push({ key: `structure.${structure}.${field}`, ...e("structures", `${structure}: ${label}`, u, "public-benchmark", "Franchisor practice for area, master and sub-franchise deals (finding F2)", REBASE, "medium", false, () => econ[field]) });
    }
  }
  for (const role of ctx.overhead.roles) {
    out.push({ key: `overhead.${ctx.overhead.key}.${role.key}`, ...e("overhead", `${role.title}: annual cost`, "usdPerYear", role.key === "founder" ? "owner-decision" : "engine-assumption", role.key === "founder" ? "Founder compensation $180,000 (owner decision 2026-09-26)" : `Starts plan month ${role.startMonth}; ${role.kind}`, REBASE, "medium", false, () => role.annual) });
  }
  for (const round of ctx.rounds) {
    for (const s of round.sources) out.push({ key: `rounds.${round.key}.sources.${s.key}`, ...e("rounds", `${round.key}: ${s.key}`, "usd", "owner-decision", "DECISIONS.md item 20", SPEC, "high", false, () => s.amount) });
    for (const u of round.uses) out.push({ key: `rounds.${round.key}.uses.${u.key}`, ...e("rounds", `${round.key}: ${u.key}`, "usd", "engine-assumption", "Round uses (DECISIONS.md items 13 and 20)", SPEC, "medium", false, () => u.amount) });
  }
  return out;
}

/** Every register row with its live value, anchor and change-log dates. */
export function registryRows(ctx: RegistryContext = registryContext()): readonly RegistryRow[] {
  const changed = new Map<string, string[]>();
  for (const c of MODEL_CHANGELOG) {
    const list = changed.get(c.key) ?? [];
    list.push(c.date);
    changed.set(c.key, list);
  }
  const rows: RegistryRow[] = [];
  const push = (key: string, entry: RegistryEntry): void => {
    rows.push({ ...entry, key, value: entry.read(ctx), anchor: registryAnchor(key), changedIn: [...(changed.get(key) ?? [])].sort().reverse() });
  };
  for (const key of REGISTRY_KEYS) push(key, ASSUMPTION_REGISTRY[key]);
  for (const entry of dynamicRegistryEntries(ctx)) push(entry.key, entry);
  return rows;
}
