import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { FinancialsModule } from "@/components/plan/modules/financials/FinancialsModule";

export default async function Page() {
  await requireSection("financials");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="financials">
      <SectionEdge sectionKey="financials" scenario={scenario} />
      <FinancialsModule key={scenario} initialScenario={scenario} />
    </SectionFrame>
  );
}
