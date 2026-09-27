import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { FloorPlanModule } from "@/components/plan/modules/floor-plan/FloorPlanModule";

export default async function FloorPlanPage() {
  await requireSection("floor-plan");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="floor-plan">
      <SectionEdge sectionKey="floor-plan" scenario={scenario} />
      <FloorPlanModule />
    </SectionFrame>
  );
}
