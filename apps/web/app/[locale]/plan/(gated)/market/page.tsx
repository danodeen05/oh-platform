import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { MarketModule } from "@/components/plan/modules/market/MarketModule";

export default async function Page() {
  await requireSection("market");
  return (
    <SectionFrame sectionKey="market">
      <MarketModule />
    </SectionFrame>
  );
}
