import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { TeamModule } from "@/components/plan/modules/team/TeamModule";

export default async function Page() {
  await requireSection("team");
  return (
    <SectionFrame sectionKey="team">
      <TeamModule />
    </SectionFrame>
  );
}
