import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { UnitEconomicsModule } from "@/components/plan/modules/unit-economics/UnitEconomicsModule";

export default async function Page() {
  await requireSection("unit-economics");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="unit-economics">
      <SectionEdge sectionKey="unit-economics" scenario={scenario} />
      <UnitEconomicsModule />
    </SectionFrame>
  );
}
