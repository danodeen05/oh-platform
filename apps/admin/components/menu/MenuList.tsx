"use client";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { money } from "@/lib/format";
import type { MenuItem } from "@/lib/menu";

type Group = { category: string; label: string; items: MenuItem[] };

const MODE_TONE: Record<string, BadgeTone> = { SLIDER: "pending", SINGLE: "info" };
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Category cards of menu rows. The row opens the editor; the switch marks it sold out. */
export function MenuList({ groups, busy, onToggle, onOpen }: {
  groups: Group[]; busy: Set<string>; onToggle: (item: MenuItem, next: boolean) => void; onOpen: (item: MenuItem) => void;
}) {
  return (
    <div className="space-y-4 lg:columns-2 lg:gap-6 lg:space-y-0">
      {groups.map((g) => (
        <div key={g.category || "none"} className="lg:mb-6 lg:break-inside-avoid">
          <Card padded={false}
            title={<span className={g.category ? "" : "text-oh-stone/70"}>{g.label}</span>}
            action={<span className="pr-2 text-sm tabular-nums text-oh-stone/60">{g.items.length} {g.items.length === 1 ? "item" : "items"}</span>}>
            {g.items.map((item) => <MenuRow key={item.id} item={item} busy={busy.has(item.id)} onToggle={onToggle} onOpen={onOpen} />)}
          </Card>
        </div>
      ))}
    </div>
  );
}

function MenuRow({ item, busy, onToggle, onOpen }: { item: MenuItem; busy: boolean; onToggle: (item: MenuItem, next: boolean) => void; onOpen: (item: MenuItem) => void }) {
  const off = !item.isAvailable;
  const extras = [
    item.additionalPriceCents > 0 && `+${money(item.additionalPriceCents)} extra`,
    item.includedQuantity > 0 && `${item.includedQuantity} incl.`,
    `Order ${item.displayOrder}`,
  ].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-1 pr-3">
      <button type="button" onClick={() => onOpen(item)} aria-label={`Edit ${item.name}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left transition-colors hover:bg-oh-linen/60 active:bg-oh-linen focus-visible:-outline-offset-2!">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${off ? "text-oh-stone/60" : "text-oh-charcoal"}`}>{item.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-oh-stone/70">
            {off && <Badge tone="alert">Sold out</Badge>}
            <span className="font-semibold tabular-nums text-oh-stone">{money(item.basePriceCents)}</span>
            <span className="tabular-nums">{extras}</span>
          </span>
          {(item.categoryType || item.selectionMode) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {item.categoryType && <Badge tone="neutral">{title(item.categoryType)}</Badge>}
              {item.selectionMode && <Badge tone={MODE_TONE[item.selectionMode] ?? "neutral"}>{title(item.selectionMode)}</Badge>}
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={18} className="hidden shrink-0 text-oh-ash lg:block" />
      </button>
      <Toggle checked={item.isAvailable} disabled={busy} hideLabel label={`Available: ${item.name}`}
        onChange={(next) => onToggle(item, next)} />
    </div>
  );
}
