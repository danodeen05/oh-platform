import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { FundingModule } from "@/components/plan/modules/funding/FundingModule";

export default async function Page() {
  await requireSection("funding");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="funding">
      <SectionEdge sectionKey="funding" scenario={scenario} />
      <FundingModule key={scenario} initialScenario={scenario} />
    </SectionFrame>
  );
}
