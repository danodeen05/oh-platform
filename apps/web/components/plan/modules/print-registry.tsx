import type { ComponentType } from "react";
import type { ScenarioKey } from "@oh/plan-model";
import type { SectionKey } from "@/lib/plan/sections";
import { ModelPrint } from "./model/ModelPrint";
import { FloorPlanPrint } from "./floor-plan/FloorPlanPrint";
import { ExpansionPrint } from "./expansion/ExpansionPrint";
import { FinancialsPrint } from "./financials/FinancialsPrint";
import { FundingPrint } from "./funding/FundingPrint";
import { IntegrityPrint } from "./integrity/IntegrityPrint";
import { SectionEdge } from "./integrity/SectionEdge";
import { ExperiencePrint, MarketPrint, OperationsPrint, RoadmapPrint, TeamPrint } from "./narrative-print";
import { SensitivityPrint, SummaryPrint, UnitEconomicsPrint } from "./summary-print";

type PrintModule = ComponentType<{ locale: string; scenario?: ScenarioKey }>;

/** Every printed section opens with its "Where Oh! is different" block, like the screen version. */
function withEdge(key: SectionKey, Module: PrintModule): PrintModule {
  const Printed = async ({ locale, scenario }: { locale: string; scenario?: ScenarioKey }) => (
    <>
      <SectionEdge sectionKey={key} tone="light" {...(scenario ? { scenario } : {})} />
      <Module locale={locale} {...(scenario ? { scenario } : {})} />
    </>
  );
  Printed.displayName = `Printed(${key})`;
  return Printed as unknown as PrintModule;
}

/**
 * Print variants by section. Only the print route imports this, so the
 * interactive pages never pull in modules they do not render (see
 * lib/plan/sections.ts on why the registry itself is metadata-only).
 */
export const PRINT_MODULES: Partial<Record<SectionKey, PrintModule>> = {
  summary: withEdge("summary", SummaryPrint),
  "unit-economics": withEdge("unit-economics", UnitEconomicsPrint),
  sensitivity: withEdge("sensitivity", SensitivityPrint),
  model: withEdge("model", ModelPrint),
  "floor-plan": withEdge("floor-plan", FloorPlanPrint),
  expansion: withEdge("expansion", ExpansionPrint),
  financials: withEdge("financials", FinancialsPrint),
  funding: withEdge("funding", FundingPrint),
  experience: withEdge("experience", ExperiencePrint),
  market: withEdge("market", MarketPrint),
  operations: withEdge("operations", OperationsPrint),
  team: withEdge("team", TeamPrint),
  roadmap: withEdge("roadmap", RoadmapPrint),
  integrity: withEdge("integrity", IntegrityPrint),
};
