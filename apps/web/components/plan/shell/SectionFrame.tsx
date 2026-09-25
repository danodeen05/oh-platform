import { getTranslations } from "next-intl/server";
import { BASE_ASSUMPTIONS } from "@oh/plan-model";
import { getSection, type SectionKey } from "@/lib/plan/sections";
import { SectionHeader } from "./SectionHeader";

interface Props {
  sectionKey: SectionKey;
  children: React.ReactNode;
}

/**
 * Wraps a section page: the `data-section` hook the analytics beacon reads,
 * the editorial header, and consistent measure. Numbers in subtitles are
 * interpolated from the engine, never typed into copy (spec 5.1).
 */
export async function SectionFrame({ sectionKey, children }: Props) {
  const t = await getTranslations("plan.sections");
  const section = getSection(sectionKey);
  const values = { pods: BASE_ASSUMPTIONS.pods, sqft: BASE_ASSUMPTIONS.squareFeet.toLocaleString() };
  return (
    <section data-section={sectionKey} className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 md:px-8 md:pb-16 md:pt-14">
      <SectionHeader order={section.order} title={t(`${section.titleKey}.title`)} subtitle={t(`${section.titleKey}.subtitle`, values)} />
      {children}
    </section>
  );
}
