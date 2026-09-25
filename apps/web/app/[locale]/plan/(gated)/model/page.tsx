import { decodeScenario, isScenarioKey, type ScenarioKey } from "@oh/plan-model";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { ModelModule } from "@/components/plan/modules/model/ModelModule";

type Props = { searchParams: Promise<{ s?: string }> };

/** The Model. `?s=` carries a shared scenario; otherwise the code's default scenario opens. */
export default async function ModelPage({ searchParams }: Props) {
  const claims = await requireSection("model");
  const { s } = await searchParams;
  const home = claims.scn.toLowerCase();
  const homeScenario: ScenarioKey = isScenarioKey(home) ? home : "base";
  const shared = decodeScenario(s);
  return (
    <SectionFrame sectionKey="model">
      <ModelModule initialScenario={shared?.base ?? homeScenario} initialOverrides={shared?.overrides ?? {}} homeScenario={homeScenario} />
    </SectionFrame>
  );
}
