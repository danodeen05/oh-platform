import { isScenarioKey, type ScenarioKey } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SensitivityModule } from "@/components/plan/modules/sensitivity/SensitivityModule";

export default async function Page() {
  const claims = await requireSection("sensitivity");
  const home = claims.scn.toLowerCase();
  const scenario: ScenarioKey = isScenarioKey(home) ? home : "base";
  return (
    <SectionFrame sectionKey="sensitivity">
      <SensitivityModule initialScenario={scenario} />
    </SectionFrame>
  );
}
