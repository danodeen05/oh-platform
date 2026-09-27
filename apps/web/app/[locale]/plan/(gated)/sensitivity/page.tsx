import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { SensitivityModule } from "@/components/plan/modules/sensitivity/SensitivityModule";

export default async function Page() {
  await requireSection("sensitivity");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="sensitivity">
      <SectionEdge sectionKey="sensitivity" scenario={scenario} />
      <SensitivityModule key={scenario} initialScenario={scenario} />
    </SectionFrame>
  );
}
