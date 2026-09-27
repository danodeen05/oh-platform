import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { TeamModule } from "@/components/plan/modules/team/TeamModule";

export default async function Page() {
  await requireSection("team");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="team">
      <SectionEdge sectionKey="team" scenario={scenario} />
      <TeamModule />
    </SectionFrame>
  );
}
