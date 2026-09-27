import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { ExperienceModule } from "@/components/plan/modules/experience/ExperienceModule";
import { FoundationPanel } from "@/components/plan/modules/foundation/FoundationPanel";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await requireSection("experience");
  const { locale } = await params;
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="experience">
      <SectionEdge sectionKey="experience" scenario={scenario} />
      <ExperienceModule />
      <div className="mt-20 md:mt-28">
        <FoundationPanel locale={locale} scenario={scenario} />
      </div>
    </SectionFrame>
  );
}
