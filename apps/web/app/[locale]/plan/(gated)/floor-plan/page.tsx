import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { FloorPlanModule } from "@/components/plan/modules/floor-plan/FloorPlanModule";

export default async function FloorPlanPage() {
  await requireSection("floor-plan");
  return (
    <SectionFrame sectionKey="floor-plan">
      <FloorPlanModule />
    </SectionFrame>
  );
}
