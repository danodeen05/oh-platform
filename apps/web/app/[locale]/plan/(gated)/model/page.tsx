import { decodeScenario } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { homeScenario } from "@/lib/plan/scenario";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { ModelModule } from "@/components/plan/modules/model/ModelModule";

type Props = { searchParams: Promise<{ s?: string }> };

/** The Model. `?s=` carries a shared scenario and wins; otherwise the reader's global scenario (cookie, then the code's default) opens. */
export default async function ModelPage({ searchParams }: Props) {
  const claims = await requireSection("model");
  const { s } = await searchParams;
  const scenario = await getPlanScenario();
  const shared = decodeScenario(s);
  const initial = shared?.base ?? scenario;
  return (
    <SectionFrame sectionKey="model">
      <SectionEdge sectionKey="model" scenario={initial} />
      <ModelModule key={s ? `shared-${s}` : initial} initialScenario={initial} initialOverrides={shared?.overrides ?? {}} homeScenario={homeScenario(claims)} />
    </SectionFrame>
  );
}
