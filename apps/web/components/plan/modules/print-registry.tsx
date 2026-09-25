import type { ComponentType } from "react";
import type { SectionKey } from "@/lib/plan/sections";
import { ModelPrint } from "./model/ModelPrint";
import { FloorPlanPrint } from "./floor-plan/FloorPlanPrint";
import { ExpansionPrint } from "./expansion/ExpansionPrint";
import { FinancialsPrint } from "./financials/FinancialsPrint";
import { FundingPrint } from "./funding/FundingPrint";
import { ExperiencePrint, MarketPrint, OperationsPrint, RoadmapPrint, TeamPrint } from "./narrative-print";
import { SensitivityPrint, SummaryPrint, UnitEconomicsPrint } from "./summary-print";

/**
 * Print variants by section. Only the print route imports this, so the
 * interactive pages never pull in modules they do not render (see
 * lib/plan/sections.ts on why the registry itself is metadata-only).
 */
export const PRINT_MODULES: Partial<Record<SectionKey, ComponentType<{ locale: string }>>> = {
  summary: SummaryPrint,
  "unit-economics": UnitEconomicsPrint,
  sensitivity: SensitivityPrint,
  model: ModelPrint,
  "floor-plan": FloorPlanPrint,
  expansion: ExpansionPrint,
  financials: FinancialsPrint,
  funding: FundingPrint,
  experience: ExperiencePrint,
  market: MarketPrint,
  operations: OperationsPrint,
  team: TeamPrint,
  roadmap: RoadmapPrint,
};
