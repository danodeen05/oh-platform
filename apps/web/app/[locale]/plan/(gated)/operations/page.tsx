import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { OperationsModule } from "@/components/plan/modules/operations/OperationsModule";

export default async function Page() {
  await requireSection("operations");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="operations">
      <SectionEdge sectionKey="operations" scenario={scenario} />
      <OperationsModule />
    </SectionFrame>
  );
}
