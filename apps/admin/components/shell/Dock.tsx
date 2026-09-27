"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, navFor, NAV_GROUPS } from "@/lib/nav";
import { useRole } from "@/components/providers/RoleProvider";
import { Icon } from "@/components/ui/icons";

/** Phone navigation: Today, Orders, Menu, More. Hidden from lg, where the sidebar takes over. */
export function Dock({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname() || "/";
  const { dock } = navFor(useRole());
  const moreHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  const active = activeHref(pathname, [...dock.map((d) => d.href), ...moreHrefs]);
  const moreActive = moreOpen || (active !== null && moreHrefs.includes(active));
  const cell = "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide transition-colors active:text-oh-cream";
  const bar = (on: boolean) => (
    <span aria-hidden="true" className={`absolute top-0 h-0.5 w-8 rounded-b-full bg-oh-gold transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`} />
  );
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-oh-cream/10 bg-oh-charcoal pb-[env(safe-area-inset-bottom)] text-oh-cream/70 lg:hidden">
      <div className="mx-auto flex max-w-md">
        {dock.map((item) => {
          const on = active === item.href && !moreOpen;
          return (
            <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={`${cell} ${on ? "text-oh-gold" : ""}`}>
              {bar(on)}
              <Icon name={item.icon} />{item.label}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} aria-expanded={moreOpen} aria-haspopup="dialog" className={`${cell} ${moreActive ? "text-oh-gold" : ""}`}>
          {bar(moreActive)}
          <Icon name="more" />More
        </button>
      </div>
    </nav>
  );
}
