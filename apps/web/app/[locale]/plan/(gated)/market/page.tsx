import { requireSection } from "@/lib/plan/session.server";
import { getPlanScenario } from "@/lib/plan/scenario.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { SectionEdge } from "@/components/plan/modules/integrity/SectionEdge";
import { MarketModule } from "@/components/plan/modules/market/MarketModule";

export default async function Page() {
  await requireSection("market");
  const scenario = await getPlanScenario();
  return (
    <SectionFrame sectionKey="market">
      <SectionEdge sectionKey="market" scenario={scenario} />
      <MarketModule />
    </SectionFrame>
  );
}
