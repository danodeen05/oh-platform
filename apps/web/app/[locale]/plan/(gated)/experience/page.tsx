import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { ExperienceModule } from "@/components/plan/modules/experience/ExperienceModule";

export default async function Page() {
  await requireSection("experience");
  return (
    <SectionFrame sectionKey="experience">
      <ExperienceModule />
    </SectionFrame>
  );
}
