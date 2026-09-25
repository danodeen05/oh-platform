import { getTranslations } from "next-intl/server";
import { requireSection } from "@/lib/plan/session.server";
import { SectionFrame } from "@/components/plan/shell/SectionFrame";
import { Placeholder } from "@/components/plan/shell/Placeholder";

export default async function Page() {
  await requireSection("expansion");
  const t = await getTranslations("plan.shell");
  return (
    <SectionFrame sectionKey="expansion">
      <Placeholder text={t("placeholder")} />
    </SectionFrame>
  );
}
