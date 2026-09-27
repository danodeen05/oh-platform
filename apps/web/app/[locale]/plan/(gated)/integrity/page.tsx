import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { IntegrityModule } from "@/components/plan/modules/integrity/IntegrityModule";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";

/** Model integrity: the certificate, the register, the scorecard, the checks, the change log, the open items. */
export default async function IntegrityPage() {
  const claims = await requireSection("integrity");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="integrity">
      <SectionEdge sectionKey="integrity" scenario={scenario} />
      <IntegrityModule audience={claims.aud} />
    </SectionFrame>
  );
}
