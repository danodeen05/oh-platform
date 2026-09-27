import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { RoadmapModule } from "@/components/plan/modules/roadmap/RoadmapModule";

export default async function Page() {
  await requireSection("roadmap");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="roadmap">
      <SectionEdge sectionKey="roadmap" scenario={scenario} />
      <RoadmapModule />
    </SectionFrame>
  );
}
