import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { RoadmapModule } from "@/components/plan/modules/roadmap/RoadmapModule";

export default async function Page() {
  await requireSection("roadmap");
  return (
    <SectionFrame sectionKey="roadmap">
      <RoadmapModule />
    </SectionFrame>
  );
}
