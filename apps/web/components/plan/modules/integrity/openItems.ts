/**
 * What the plan has not yet validated with an outside party. Each item names
 * the registry keys it would confirm, so the assumptions register can show
 * "awaiting: pod fabrication quote" beside a low-confidence row. Keys are
 * registry keys as strings (see packages/plan-model registry.ts); a test
 * asserts every one resolves to a live register row.
 */
export type OpenItemStatus = "not-started" | "requested" | "in-progress" | "received" | "validated";
export type OpenItemOwner = "founder" | "partner" | "cpa" | "counsel" | "architect" | "supplier" | "engineering";

export interface OpenItem {
  key: string;
  /** i18n key suffix under plan.integrity.openItems.items */
  status: OpenItemStatus;
  owner: OpenItemOwner;
  validates: readonly string[];
  due?: string;
}

export const OPEN_ITEMS: readonly OpenItem[] = [
  { key: "beefQuotes", status: "not-started", owner: "supplier", validates: ["menu.wagyuCostPerLb", "menu.primeCostPerLb", "unit.foodCostPct"] },
  { key: "produceQuotes", status: "not-started", owner: "supplier", validates: ["menu.baseBowlCost"] },
  { key: "leaseLoi", status: "not-started", owner: "founder", validates: ["unit.rentPerSqFtAnnual", "unit.nnnPerSqFtAnnual", "unit.tenantImprovementAllowancePerSqFt", "unit.rentEscalationPct"] },
  { key: "permits", status: "in-progress", owner: "architect", validates: ["unit.designArchPermits", "unit.preOpeningMonths"] },
  { key: "podFabricationQuote", status: "not-started", owner: "supplier", validates: ["unit.podUnitCost", "capexSubsequent.podUnitCost"] },
  { key: "commissaryThroughput", status: "received", owner: "founder", validates: ["unit.avgDwellMinutes", "unit.turnoverMinutes"] },
  { key: "wageSurvey", status: "not-started", owner: "founder", validates: ["unit.avgKitchenWage", "unit.avgManagerSalary", "unit.payrollBurdenPct"] },
  { key: "insuranceQuotes", status: "not-started", owner: "founder", validates: ["unit.insuranceAnnual"] },
  { key: "fdd", status: "not-started", owner: "counsel", validates: ["franchise.unitFranchiseFee", "franchise.royaltyPct", "franchise.marketingFundPct"] },
  { key: "operatingAgreement", status: "requested", owner: "counsel", validates: ["partnership.partnerPctCap", "partnership.founderCapital"] },
  { key: "cpaReview", status: "not-started", owner: "cpa", validates: ["partnership.taxDistributionRate", "partnership.distributionPct"] },
  { key: "memberProgramBuild", status: "not-started", owner: "engineering", validates: ["unit.memberProgramPct", "unit.memberSwagAnnual"] },
  // 2026-09-27: the 1% pledge to ONE RED STEP AT A TIME is a related-party arrangement, so it gets a written agreement.
  { key: "givingAgreement", status: "not-started", owner: "counsel", validates: ["unit.communityGivingPct"] },
  { key: "franchisePledge", status: "not-started", owner: "counsel", validates: ["unit.communityGivingPct", "franchise.royaltyPct"] },
];
