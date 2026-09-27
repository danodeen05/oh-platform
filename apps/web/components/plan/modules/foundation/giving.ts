import { FRANCHISE_MARKETS, FRANCHISE_TERMS, OPENING_SCHEDULE, SCENARIOS, computeCompany, computeLocation, type ScenarioKey } from "@oh/plan-model";

export interface GivingFigures {
  /** The pledge as a share of revenue, e.g. 0.01. */
  pct: number;
  /** One steady-state unit, per year. */
  perUnit: number;
  /** Company restaurants, plan years 1 to 5 (corporate revenue × pledge). Franchise units carry no pledge cost to Oh!. */
  fiveYear: number;
  /** Company restaurants open at the end of year 5. */
  units: number;
}

/** The 1% pledge in dollars, straight from the engine, for the reader's scenario. */
export function givingFigures(scenario: ScenarioKey = "base"): GivingFigures {
  const sc = SCENARIOS[scenario];
  const pct = sc.assumptions.communityGivingPct;
  const loc = computeLocation(sc.assumptions);
  const company = computeCompany({ scenario: sc, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
  const fiveYear = company.years.reduce((s, y) => s + y.corporateRevenue * pct, 0);
  return { pct, perUnit: loc.communityGiving, fiveYear, units: company.years[company.years.length - 1]?.corporateLocations ?? 0 };
}
