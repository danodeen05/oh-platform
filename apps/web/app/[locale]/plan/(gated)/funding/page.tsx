import { isScenarioKey, type ScenarioKey } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { FundingModule } from "@/components/plan/modules/funding/FundingModule";

export default async function Page() {
  const claims = await requireSection("funding");
  const home = claims.scn.toLowerCase();
  const scenario: ScenarioKey = isScenarioKey(home) ? home : "base";
  return (
    <SectionFrame sectionKey="funding">
      <FundingModule initialScenario={scenario} />
    </SectionFrame>
  );
}
