"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, navFor, type NavItem } from "@/lib/nav";
import { useRole } from "@/components/providers/RoleProvider";
import { Icon } from "@/components/ui/icons";
import { OrderNowSwitch } from "./OrderNowSwitch";
import { AccountButton } from "./AccountButton";

/** Desktop navigation from lg: the dock items, then the same groups as the More sheet. */
export function Sidebar() {
  const pathname = usePathname() || "/";
  const role = useRole();
  const { dock, groups } = navFor(role);
  const active = activeHref(pathname, [...dock, ...groups.flatMap((g) => g.items)].map((i) => i.href));
  const canSwitch = role === "owner" || role === "manager";

  const item = (i: NavItem) => {
    const on = active === i.href;
    return (
      <li key={i.href}>
        <Link href={i.href} aria-current={on ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${on ? "bg-oh-cream/10 text-oh-gold" : "text-oh-cream/75 hover:bg-oh-cream/5 hover:text-oh-cream"}`}>
          <Icon name={i.icon} size={20} className="shrink-0" />
          <span className="truncate">{i.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside aria-label="Sections" className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[248px] flex-col border-r border-oh-cream/10 bg-oh-charcoal text-oh-cream">
      <Link href="/" className="flex h-14 shrink-0 items-center gap-2.5 px-5">
        <img src="/Oh_Logo_Mark_Light.png" alt="Oh!" className="h-7 w-7 object-contain" />
        <span className="font-display text-[1.625rem] leading-none">Admin</span>
      </Link>
      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-6">
        <ul className="space-y-0.5">{dock.map(item)}</ul>
        {groups.map((g) => (
          <div key={g.title} className="mt-6">
            <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-oh-cream/50">{g.title}</h2>
            <ul className="space-y-0.5">{g.items.map(item)}</ul>
            {g.title === "Stores" && canSwitch && <div className="mt-0.5"><OrderNowSwitch variant="row" surface="dark" /></div>}
          </div>
        ))}
      </nav>
      <div className="flex min-h-16 shrink-0 items-center gap-3 border-t border-oh-cream/10 px-5">
        <AccountButton />
      </div>
    </aside>
  );
}
