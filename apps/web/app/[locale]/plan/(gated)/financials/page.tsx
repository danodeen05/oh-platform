import { isScenarioKey, type ScenarioKey } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { FinancialsModule } from "@/components/plan/modules/financials/FinancialsModule";

export default async function Page() {
  const claims = await requireSection("financials");
  const home = claims.scn.toLowerCase();
  const scenario: ScenarioKey = isScenarioKey(home) ? home : "base";
  return (
    <SectionFrame sectionKey="financials">
      <FinancialsModule initialScenario={scenario} />
    </SectionFrame>
  );
}
