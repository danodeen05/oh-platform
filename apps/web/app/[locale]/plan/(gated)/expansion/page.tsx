import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { ExpansionModule } from "@/components/plan/modules/expansion/ExpansionModule";

export default async function ExpansionPage() {
  await requireSection("expansion");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="expansion">
      <SectionEdge sectionKey="expansion" scenario={scenario} />
      <ExpansionModule />
    </SectionFrame>
  );
}
