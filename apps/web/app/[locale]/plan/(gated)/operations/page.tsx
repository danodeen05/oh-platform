import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { OperationsModule } from "@/components/plan/modules/operations/OperationsModule";

export default async function Page() {
  await requireSection("operations");
  return (
    <SectionFrame sectionKey="operations">
      <OperationsModule />
    </SectionFrame>
  );
}
