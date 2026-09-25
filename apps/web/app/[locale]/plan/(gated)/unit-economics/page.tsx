import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { UnitEconomicsModule } from "@/components/plan/modules/unit-economics/UnitEconomicsModule";

export default async function Page() {
  await requireSection("unit-economics");
  return (
    <SectionFrame sectionKey="unit-economics">
      <UnitEconomicsModule />
    </SectionFrame>
  );
}
