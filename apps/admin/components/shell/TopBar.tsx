"use client";
import { usePathname } from "next/navigation";
import { activeHref, DOCK_ITEMS, NAV_GROUPS } from "@/lib/nav";
import { LocationSwitcher } from "./LocationSwitcher";
import { AccountButton } from "./AccountButton";

const ALL_ITEMS = [...DOCK_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)];

/** The section a path belongs to, for the phone title. */
export function sectionLabel(pathname: string): string {
  const href = activeHref(pathname, ALL_ITEMS.map((i) => i.href));
  return ALL_ITEMS.find((i) => i.href === href)?.label ?? "Admin";
}

export function TopBar() {
  const label = sectionLabel(usePathname() || "/");
  return (
    <header className="sticky top-0 z-30 bg-oh-charcoal pt-[env(safe-area-inset-top)] text-oh-cream">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
          <img src="/Oh_Logo_Mark_Light.png" alt="Oh!" className="h-7 w-7 shrink-0 object-contain" />
          <span className="truncate font-display text-[1.5rem] leading-none">{label}</span>
        </div>
        <div className="hidden flex-1 lg:block" />
        <LocationSwitcher />
        <div className="lg:hidden"><AccountButton /></div>
      </div>
    </header>
  );
}
