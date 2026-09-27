"use client";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { activeHref, navFor } from "@/lib/nav";
import { useRole } from "@/components/providers/RoleProvider";
import { Icon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { OrderNowSwitch } from "./OrderNowSwitch";

/** Everything past the dock, grouped the same way as the sidebar. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() || "/";
  const role = useRole();
  const { groups } = navFor(role);
  const active = activeHref(pathname, groups.flatMap((g) => g.items.map((i) => i.href)));
  const canSwitch = role === "owner" || role === "manager";
  // Close as soon as a link is tapped, even when it points at the current page.
  const closeOnLink = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("a")) onClose(); };

  return (
    <Sheet open={open} onClose={onClose} title="More" size="auto">
      <div className="space-y-5" onClickCapture={closeOnLink}>
        {groups.map((g) => (
          <section key={g.title}>
            <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-oh-ash">{g.title}</h3>
            <div className="divide-y divide-oh-stone/10 overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream">
              {g.items.map((i) => {
                const on = active === i.href;
                return (
                  <ListRow key={i.href} href={i.href} title={i.label}
                    leading={
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${on ? "bg-oh-charcoal text-oh-gold" : "bg-oh-linen text-oh-stone"}`}>
                        <Icon name={i.icon} size={18} />
                      </span>
                    } />
                );
              })}
              {g.title === "Stores" && canSwitch && <OrderNowSwitch variant="row" />}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
