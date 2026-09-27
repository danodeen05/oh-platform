"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sectionFromPath, sectionHref, type PlanSection } from "@/lib/plan/sections";
import { SectionGlyph } from "./icons";
import { PlanPaletteTrigger } from "./PlanPalette";

export interface NavSection {
  key: PlanSection["key"];
  slug: PlanSection["slug"];
  icon: PlanSection["icon"];
  order: number;
  title: string;
}

interface Props {
  locale: string;
  sections: readonly NavSection[];
  labels: { sections: string };
  /** Phone bottom bar only: a "Contents" button that opens the palette mounted in the header. */
  paletteLabel?: string;
}

/**
 * Section navigation. Tablets and up (md): icon chips in a seven-column grid
 * under the top bar, so thirteen sections make two even rows and nothing
 * ever scrolls off the side. The current section is the bright chip with a
 * soft ember ring that breathes (see .plan-nav-current in globals.css; it
 * holds still under reduced motion). Phones: a fixed bottom bar that scrolls
 * sideways, thumb-reachable (spec 3.3 and 7.1). Both render from the same list.
 */
export function PlanNav({ locale, sections, labels, paletteLabel }: Props) {
  const pathname = usePathname();
  const current = sectionFromPath(pathname);
  const list = useRef<HTMLUListElement>(null);

  // Phone bar: bring the active chip into view when the route changes, so the
  // reader never lands on a section whose chip is scrolled off the side.
  useEffect(() => {
    const ul = list.current;
    if (!ul || ul.scrollWidth <= ul.clientWidth) return;
    const chip = ul.querySelector<HTMLElement>('[aria-current="page"]');
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [current]);

  return (
    <nav aria-label={labels.sections} className="plan-nav flex items-stretch gap-1">
      {paletteLabel ? (
        <PlanPaletteTrigger
          label={paletteLabel}
          className="mr-1 shrink-0 self-stretch rounded-md border-r border-oh-stone bg-transparent px-3 text-[0.68rem] leading-none tracking-wide text-oh-mute hover:bg-oh-ink/60 hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember md:hidden"
        />
      ) : null}
      {/* Phones: one scrolling row in the bottom bar. md and up: a grid, seven chips per row, so thirteen sections make two even rows. */}
      <ul ref={list} className="m-0 flex min-w-0 flex-1 list-none gap-1 overflow-x-auto p-0 md:grid md:grid-cols-7 md:gap-1.5 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const active = s.key === current;
          return (
            <li key={s.key} className="shrink-0 snap-start lg:min-w-0">
              <Link
                href={sectionHref(locale, s)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-1 rounded-md px-3 py-2 text-[0.68rem] leading-none tracking-wide transition-colors md:min-w-0 md:text-[0.72rem] lg:flex-row lg:justify-center lg:gap-2 lg:text-[0.8rem]",
                  active ? "plan-nav-current bg-oh-ink text-oh-cream" : "text-oh-mute hover:bg-oh-ink/60 hover:text-oh-cream",
                ].join(" ")}
              >
                <SectionGlyph icon={s.icon} className={active ? "shrink-0 text-oh-ember" : "shrink-0 text-current"} />
                <span className="max-w-[5.5rem] truncate md:max-w-full lg:max-w-none">{s.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
