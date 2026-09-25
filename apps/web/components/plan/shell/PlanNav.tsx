"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionFromPath, sectionHref, type PlanSection } from "@/lib/plan/sections";
import { SectionGlyph } from "./icons";

export interface NavSection {
  key: PlanSection["key"];
  slug: PlanSection["slug"];
  icon: PlanSection["icon"];
  title: string;
}

interface Props {
  locale: string;
  sections: readonly NavSection[];
  labels: { sections: string };
}

/**
 * Section navigation. Desktop: a horizontally scrolling row under the top
 * bar. Phones: a fixed bottom bar with icons and short labels, thumb-reachable
 * (spec 3.3 and 7.1). Both render from the same list; CSS decides.
 */
export function PlanNav({ locale, sections, labels }: Props) {
  const pathname = usePathname();
  const current = sectionFromPath(pathname);

  return (
    <nav aria-label={labels.sections} className="plan-nav">
      <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 md:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const active = s.key === current;
          return (
            <li key={s.key} className="shrink-0 snap-start">
              <Link
                href={sectionHref(locale, s)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-1 rounded-md px-3 py-2 text-[0.68rem] leading-none tracking-wide transition-colors md:flex-row md:gap-2 md:px-3 md:py-1.5 md:text-[0.8rem]",
                  active ? "bg-oh-ink text-oh-cream" : "text-oh-mute hover:bg-oh-ink/60 hover:text-oh-cream",
                ].join(" ")}
              >
                <SectionGlyph icon={s.icon} className={active ? "text-oh-ember" : "text-current"} />
                <span className="max-w-[5.5rem] truncate md:max-w-none">{s.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
