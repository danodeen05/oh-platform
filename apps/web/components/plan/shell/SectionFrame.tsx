import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { BASE_ASSUMPTIONS } from "@oh/plan-model";
import { getSection, sectionHref, visibleSections, type SectionKey } from "@/lib/plan/sections";
import { getPlanSession } from "@/lib/plan/session.server";
import { sectionReadingMinutes } from "@/lib/plan/readingTime";
import { SectionHeader } from "./SectionHeader";
import { SectionFooter, type FooterNeighbor } from "./SectionFooter";

interface Props {
  sectionKey: SectionKey;
  children: React.ReactNode;
}

/**
 * Wraps a section page: the `data-section` hook the analytics beacon reads,
 * the editorial header, consistent measure, and the footer (where you are,
 * previous and next with reading times, ask Chappy). Numbers in
 * subtitles are interpolated from the engine, never typed into copy (spec 5.1).
 */
export async function SectionFrame({ sectionKey, children }: Props) {
  const [t, tsh, locale, messages, claims] = await Promise.all([getTranslations("plan.sections"), getTranslations("plan.shell"), getLocale(), getMessages(), getPlanSession()]);
  const section = getSection(sectionKey);
  const values = { pods: BASE_ASSUMPTIONS.pods, sqft: BASE_ASSUMPTIONS.squareFeet.toLocaleString() };
  const title = t(`${section.titleKey}.title`);

  const plan = ((messages as Record<string, unknown>).plan ?? {}) as Record<string, unknown>;
  const visible = claims ? visibleSections(claims) : [section];
  const index = Math.max(0, visible.findIndex((s) => s.key === sectionKey));
  const neighbor = (s: (typeof visible)[number] | undefined): FooterNeighbor | null =>
    s ? { key: s.key, href: sectionHref(locale, s), order: s.order, title: t(`${s.titleKey}.title`), subtitle: t(`${s.titleKey}.subtitle`, values), minutes: sectionReadingMinutes(plan, s.key, locale) } : null;

  return (
    <section data-section={sectionKey} className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 md:px-8 md:pb-16 md:pt-14">
      <SectionHeader order={section.order} title={title} subtitle={t(`${section.titleKey}.subtitle`, values)} />
      {children}
      <SectionFooter
        sectionKey={sectionKey}
        position={{ index: index + 1, total: visible.length }}
        previous={neighbor(visible[index - 1])}
        next={neighbor(visible[index + 1])}
        labels={{
          previous: tsh("footer.previous"),
          next: tsh("footer.next"),
          readingTime: (minutes) => tsh("footer.readingTime", { minutes }),
          sectionOf: tsh("footer.sectionOf", { n: index + 1, total: visible.length }),
          ask: tsh("askChappy"),
        }}
      />
    </section>
  );
}
