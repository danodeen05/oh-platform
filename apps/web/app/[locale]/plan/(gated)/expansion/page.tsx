import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { ExpansionModule } from "@/components/plan/modules/expansion/ExpansionModule";

export default async function ExpansionPage() {
  await requireSection("expansion");
  return (
    <SectionFrame sectionKey="expansion">
      <ExpansionModule />
    </SectionFrame>
  );
}
