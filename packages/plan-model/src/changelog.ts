/**
 * Model change log and headline snapshots (2026-09-26, Model integrity
 * section). Every change to a preset or a formula gets a row: what moved,
 * from what to what, why, who decided, and where it is written down. The
 * snapshots pin the headline numbers per model version; a test asserts the
 * latest snapshot equals the live engine so the log can never drift from
 * the model it describes.
 */
export type DecidedBy = "owner" | "review" | "engine";

export interface ChangeEntry {
  /** ISO date. */
  date: string;
  /** Review finding id (R1, C2, K1...) or a decision id (D21). */
  finding: string;
  /** Registry key the change touched, or a formula name. */
  key: string;
  before: number | string | null;
  after: number | string | null;
  unit: string;
  reason: string;
  decidedBy: DecidedBy;
  /** Where the decision is recorded. */
  ref: string;
}

export interface ModelSnapshot {
  version: string;
  date: string;
  label: string;
  /** Base-case steady-state unit revenue. */
  unitRevenue: number;
  /** Base-case unit EBITDA margin. */
  ebitdaMargin: number;
  /** Flagship payback from opening, years (null when it does not resolve). */
  paybackFromOpening: number | null;
  /** Headline partner stake. */
  partnerPct: number;
  /** Total capital raised. */
  totalCapital: number;
  /** Exit-year EBITDA used for the partner math. */
  exitEbitda: number;
  /** Partner multiple at the headline stake. */
  partnerMultiple: number;
  /** Franchise units open at the end of year 5. */
  franchiseUnitsY5: number;
  /** Corporate overhead in year 5. */
  overheadY5: number;
}

const D = "DECISIONS.md";
const C = "packages/plan-model/CHANGELOG.md";

export const MODEL_CHANGELOG: readonly ChangeEntry[] = Object.freeze([
  // Owner decisions of 2026-09-25 (DECISIONS.md items 17 to 24) that changed engine values
  { date: "2026-09-25", finding: "D17", key: "unit.annualHoursPerFTE", before: 1850, after: 2080, unit: "hours", reason: "CPA convention; 1,850 reproduced the spec table but is not a defensible staffing assumption", decidedBy: "owner", ref: `${D} #17` },
  { date: "2026-09-25", finding: "D18", key: "schedule.slc.openMonth", before: 4, after: 16, unit: "months", reason: "Locations 2 to 5 at T0+16/19/22/25 reproduce the spec 5.8 revenue table", decidedBy: "owner", ref: `${D} #18` },
  { date: "2026-09-25", finding: "D19", key: "loan.principal", before: 1_500_000, after: 0, unit: "usd", reason: "No SBA loan; the plan is equity funded, the reference loan stays a lender lever", decidedBy: "owner", ref: `${D} #19` },
  { date: "2026-09-25", finding: "D20", key: "partnership.partnerCapital", before: 10_000_000, after: 10_500_000, unit: "usd", reason: "Two rounds: $3.2M pre-opening ($3.0M partner) and $7.5M at T0+12", decidedBy: "owner", ref: `${D} #20` },
  { date: "2026-09-25", finding: "D21", key: "computeOwnership", before: "asserted 49/51", after: "derived from partner capital, target multiple and exit value", unit: "formula", reason: "Ownership is derived, never asserted", decidedBy: "owner", ref: `${D} #21` },
  { date: "2026-09-25", finding: "D24", key: "partnership.partnerPctCap", before: 1, after: 0.49, unit: "pct", reason: "Founder keeps control in every scenario; the gap is shown, not hidden", decidedBy: "owner", ref: `${D} #24` },
  { date: "2026-09-26", finding: "D-markets", key: "market.paris.unitsByYear", before: "Y5: 1", after: "Y7: 1", unit: "units", reason: "Growth by new markets; superseded the same day by the phased schedule below", decidedBy: "owner", ref: `${C} 2026-09-26` },
  // Re-baseline of 2026-09-26 (diligence review). Revenue
  { date: "2026-09-26", finding: "R1", key: "unit.operatingDaysPerYear", before: 355, after: 313, unit: "days", reason: "Closed Sundays; 355 overstated revenue by 13%", decidedBy: "owner", ref: `${D} #25` },
  { date: "2026-09-26", finding: "R2", key: "unit.avgBowlPrice", before: 19.5, after: 19.39, unit: "usd", reason: "Blended from the reset menu ($17.99 / $27.99 / $12.99 at 68 / 20 / 12); the check is now derived from the menu, not asserted", decidedBy: "owner", ref: `${D} #26` },
  { date: "2026-09-26", finding: "R2", key: "unit.addOnAttachRate", before: 0.62, after: 0.6, unit: "pct", reason: "Re-derived from the live menu", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R2", key: "unit.avgAddOnSpend", before: 6.25, after: 3.9, unit: "usd", reason: "$1.99 to $5.99 add-ons cannot average $6.25", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R2", key: "unit.beverageAttachRate", before: 0.55, after: 0.4, unit: "pct", reason: "Free water on the menu", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R2", key: "unit.avgBeverageSpend", before: 4.5, after: 2.49, unit: "usd", reason: "A $2.49 soda cannot average $4.50", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R3", key: "unit.discountsCompsPct", before: null, after: 0.015, unit: "pct", reason: "No comps line existed; fast-casual runs 1% to 2%", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R5", key: "unit.salesTaxPct", before: null, after: 0.0835, unit: "pct", reason: "Sales tax not addressed; prices tax-exclusive, revenue net, processing on the gross ticket", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R6", key: "unit.rentEscalationPct", before: null, after: 0.03, unit: "pct", reason: "No escalation on rent", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R6", key: "unit.wageInflationPct", before: null, after: 0.035, unit: "pct", reason: "No escalation on wages", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R6", key: "unit.cogsInflationPct", before: null, after: 0.03, unit: "pct", reason: "No escalation on food cost", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "R6", key: "unit.menuPriceGrowthPct", before: null, after: 0.025, unit: "pct", reason: "No price growth; set below cost inflation on purpose", decidedBy: "review", ref: `${C} 2026-09-26` },
  // COGS
  { date: "2026-09-26", finding: "C1", key: "unit.foodCostPct", before: 0.3, after: 0.3271, unit: "pct", reason: "Bowl-level build with USDA Prime at $6.25/lb and American Wagyu at $11.00/lb, 55% yield, 4 / 4.5 oz cooked, 2% waste; supplier quotes open", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "C2", key: "unit.memberProgramPct", before: null, after: 0.014, unit: "pct", reason: "Member program was not costed (about 4.1% as designed); recommended design costs about 2.1% all-in", decidedBy: "owner", ref: `${D} #27` },
  { date: "2026-09-26", finding: "C2", key: "unit.memberSwagAnnual", before: null, after: 30_000, unit: "usd", reason: "Fixed program spend: swag, VIP gifts, events, Wall of Fame", decidedBy: "owner", ref: `${D} #27` },
  // Labor
  { date: "2026-09-26", finding: "L1", key: "unit.kitchenFTE", before: 7, after: 11.7, unit: "FTE", reason: "7 FTE is one day's schedule; 75 scheduled hours a day over 313 days with 4% coverage is 11.7 FTE", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "L1", key: "unit.kitchenHoursPerDay", before: null, after: 75, unit: "hours", reason: "The Operations page's schedule, summed", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "L1", key: "unit.coverageFactorPct", before: null, after: 0.04, unit: "pct", reason: "PTO, sick and training coverage", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "L2", key: "unit.payrollBurdenPct", before: 0.18, after: 0.22, unit: "pct", reason: "18% carried no health benefits for a salaried no-tip team", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "L3", key: "unit.avgKitchenWage", before: 24, after: 21, unit: "usd/hour", reason: "Blended by role at Utah County market rates", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "L3", key: "unit.avgManagerSalary", before: 72_000, after: 63_500, unit: "usd", reason: "GM $70K and AGM $57K", decidedBy: "review", ref: `${C} 2026-09-26` },
  // Other opex
  { date: "2026-09-26", finding: "O1", key: "unit.gaPct", before: 0.025, after: 0.015, unit: "pct", reason: "Corporate G&A moved above the unit into overhead.ts", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "O2", key: "unit.contingencyPct", before: 0.02, after: 0.01, unit: "pct", reason: "Halved once the missing cost layers were modeled explicitly", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "O3", key: "unit.paymentProcessingPct", before: 0.027, after: 0.03, unit: "pct", reason: "Card-only kiosks; charged on the gross ticket", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "O4", key: "unit.utilitiesPct", before: 0.03, after: 0.025, unit: "pct", reason: "Fast-casual 2% to 3%", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "O4", key: "unit.suppliesPct", before: 0.022, after: 0.015, unit: "pct", reason: "Fast-casual 1% to 2%", decidedBy: "review", ref: `${C} 2026-09-26` },
  // Corporate
  { date: "2026-09-26", finding: "K1", key: "overhead.full.founder", before: null, after: 180_000, unit: "usd", reason: "No corporate overhead existed; founder compensation set by the owner, full role schedule in overhead.ts", decidedBy: "owner", ref: `${D} #28` },
  { date: "2026-09-26", finding: "K2", key: "computePortfolio.investments", before: null, after: "600K platform build (Y1), 1.0M corporate infrastructure (Y2)", unit: "formula", reason: "Round uses that were never expensed are now cash out and amortized", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K3", key: "computeDepreciation", before: null, after: "7 / 10 / 3 year lives", unit: "formula", reason: "No D&A existed; needed for the tax line", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K4", key: "unit.maintenanceCapexPct", before: null, after: 0.015, unit: "pct", reason: "No maintenance capex existed", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K5", key: "unit.preOpening", before: 185_000, after: 110_000, unit: "usd", reason: "Pre-opening expensed over 3 months instead of capitalized; $75K carved out as launch marketing so the $1.71M total holds", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "M1", key: "unit.launchMarketing", before: null, after: 75_000, unit: "usd", reason: "Opening budget was not in the model", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K5", key: "unit.preOpeningMonths", before: null, after: 3, unit: "months", reason: "Pre-opening expensed, not capitalized", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K6", key: "partnership.taxDistributionRate", before: null, after: 0.37, unit: "pct", reason: "LLC pass-through; no tax distributions existed", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "K6", key: "partnership.distributionPct", before: "0.5 of unit EBITDA", after: "0.5 of post-tax free cash flow", unit: "formula", reason: "Distributions ignored tax, overhead and cash needs", decidedBy: "review", ref: `${C} 2026-09-26` },
  // Ramp
  { date: "2026-09-26", finding: "P1", key: "unit.rampCurve", before: "1.18 ... 1.06 (18 months)", after: "0.70 ... 1.00 (12 months)", unit: "index", reason: "A new unit does not open at 118% of steady state or plateau at 106% forever", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "P1", key: "unit.rampPlateau", before: 1.06, after: 1, unit: "index", reason: "Steady state is steady state; growth comes from price", decidedBy: "review", ref: `${C} 2026-09-26` },
  // Franchise
  { date: "2026-09-26", finding: "F1", key: "market.las-vegas.unitsByYear", before: "Y4: 1; Y5: 1", after: "Y4: 1; Y5: 1; Y6: 1; Y7: 1", unit: "units", reason: "Phased schedule: 7 units in 5 markets by year 5, 15 by year 6, 27 by year 7; wave two from year 8", decidedBy: "owner", ref: `${D} #29` },
  { date: "2026-09-26", finding: "F1", key: "franchiseUnitsY5", before: 36, after: 7, unit: "units", reason: "An FDD is effective about month 24; NY, CA and WA are registration states", decidedBy: "owner", ref: `${D} #29` },
  { date: "2026-09-26", finding: "F2", key: "structure.master-franchise.royaltyShare", before: 1, after: 0.5, unit: "pct", reason: "Structure had no economic effect; masters keep half and the brand carries sales, entry, opening and support costs", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "F3", key: "market.tokyo.structure", before: "jv", after: "master-franchise", unit: "text", reason: "JVs need brand capital; every JV converts to a master franchise", decidedBy: "owner", ref: `${D} #30` },
  { date: "2026-09-26", finding: "F4", key: "computeOwnership.exitEbitda", before: "unit EBITDA + platform GP + 60% of royalties and unit fees", after: "unit EBITDA − overhead + recurring franchise profit + platform GP", unit: "formula", reason: "Overhead was missing and one-time fees were capitalized", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "F4", key: "PlatformYear.royalties", before: "gross", after: "brand-received (gross kept in grossRoyalties)", unit: "formula", reason: "Semantic change so company revenue is what the brand receives", decidedBy: "review", ref: `${C} 2026-09-26` },
  { date: "2026-09-26", finding: "F4", key: "partnership.franchiseMarginPct", before: 0.6, after: "deprecated", unit: "pct", reason: "Replaced by STRUCTURE_ECONOMICS; kept so readers compile", decidedBy: "review", ref: `${C} 2026-09-26` },
  // Ownership
  { date: "2026-09-26", finding: "W1", key: "partnership.preferredReturnPct", before: null, after: 0.08, unit: "pct", reason: "Preferred construct: 8% pref, 1x liquidation preference, common capped at 49%", decidedBy: "owner", ref: `${D} #31` },
  { date: "2026-09-26", finding: "W1", key: "partnership.liquidationPreference", before: null, after: 1, unit: "multiple", reason: "Preferred construct", decidedBy: "owner", ref: `${D} #31` },
  { date: "2026-09-26", finding: "W1", key: "partnership.exitYear", before: 5, after: "5 headline, 7 shown", unit: "years", reason: "Year 7 at a hybrid multiple shown alongside year 5", decidedBy: "owner", ref: `${D} #31` },
  { date: "2026-09-26", finding: "T1", key: "PUBLIC_EBITDA_TARGET", before: 0.25, after: 0.15, unit: "pct", reason: "Public four-wall target 15%, 20% at maturity as the stretch", decidedBy: "owner", ref: `${D} #32` },
  { date: "2026-09-26", finding: "S1", key: "SHARE_VERSION", before: 1, after: 2, unit: "version", reason: "Lever meanings changed; old links fail closed", decidedBy: "engine", ref: `${C} 2026-09-26` },
  // Owner decision of 2026-09-27: the community giving pledge
  { date: "2026-09-27", finding: "D35", key: "unit.communityGivingPct", before: null, after: 0.01, unit: "pct", reason: "1% of revenue from every company restaurant to ONE RED STEP AT A TIME, a mental-health 501(c)(3) and a disclosed related party; an opex line, so base four-wall EBITDA falls one point", decidedBy: "owner", ref: `${D} #35` },
]);

export const MODEL_SNAPSHOTS: readonly ModelSnapshot[] = Object.freeze([
  {
    version: "2026.09.25",
    date: "2026-09-25",
    label: "Spec presets with the owner decisions of 2026-09-25",
    unitRevenue: 4_201_425,
    ebitdaMargin: 0.297,
    paybackFromOpening: 1.4232,
    partnerPct: 0.45,
    totalCapital: 10_700_000,
    exitEbitda: 11_741_284,
    partnerMultiple: 3.02,
    franchiseUnitsY5: 36,
    overheadY5: 0,
  },
  {
    version: "2026.09.26",
    date: "2026-09-26",
    label: "Re-baseline after the diligence review",
    unitRevenue: 3_264_340,
    ebitdaMargin: 0.1449,
    paybackFromOpening: 4.3474,
    partnerPct: 0.49,
    totalCapital: 10_700_000,
    exitEbitda: 645_638,
    partnerMultiple: 0.18,
    franchiseUnitsY5: 7,
    overheadY5: 2_876_200,
  },
  {
    version: "2026.09.27",
    date: "2026-09-27",
    label: "Community giving pledge: 1% of revenue to ONE RED STEP AT A TIME",
    unitRevenue: 3_264_340,
    ebitdaMargin: 0.1349,
    paybackFromOpening: 4.7295,
    partnerPct: 0.49,
    totalCapital: 10_700_000,
    exitEbitda: 471_419,
    partnerMultiple: 0.13,
    franchiseUnitsY5: 7,
    overheadY5: 2_876_200,
  },
]);

export interface HeadlineDelta {
  key: keyof Omit<ModelSnapshot, "version" | "date" | "label">;
  before: number | null;
  after: number | null;
  /** after − before, null when either side is null. */
  delta: number | null;
}

/** Headline movements between two snapshots, in snapshot field order. */
export function headlineDeltas(previous: ModelSnapshot, current: ModelSnapshot): readonly HeadlineDelta[] {
  const keys: HeadlineDelta["key"][] = ["unitRevenue", "ebitdaMargin", "paybackFromOpening", "partnerPct", "totalCapital", "exitEbitda", "partnerMultiple", "franchiseUnitsY5", "overheadY5"];
  return keys.map((key) => {
    const before = previous[key];
    const after = current[key];
    return { key, before, after, delta: before === null || after === null ? null : after - before };
  });
}

/** The snapshot for the current model version. */
export function latestSnapshot(): ModelSnapshot {
  return MODEL_SNAPSHOTS[MODEL_SNAPSHOTS.length - 1] as ModelSnapshot;
}
