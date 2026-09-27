"use client";
import { useState } from "react";
import { useLocationFilter } from "@/components/providers/LocationProvider";
import { Icon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";

/** Pill in the top bar. The choice is saved per device and read by pages through useLocationFilter(). */
export function LocationSwitcher() {
  const { locations, locationId, setLocationId } = useLocationFilter();
  const [open, setOpen] = useState(false);
  const current = locations.find((l) => l.id === locationId);
  const name = current?.name ?? "All locations";
  const choose = (id: string) => { setLocationId(id); setOpen(false); };
  const check = (on: boolean) => on
    ? <Icon name="check" size={20} className="text-oh-ember-deep" />
    : <span className="h-5 w-5" aria-hidden="true" />;
  const pinTile = (on: boolean) => (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${on ? "bg-oh-charcoal text-oh-gold" : "bg-oh-linen text-oh-stone"}`}>
      <Icon name="pin" size={18} />
    </span>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Location: ${name}. Change location`}
        className="inline-flex min-h-11 min-w-11 max-w-[52vw] shrink items-center gap-1.5 rounded-full border border-oh-cream/15 bg-oh-cream/5 py-2 pl-3 pr-2.5 text-sm font-semibold text-oh-cream transition-colors hover:bg-oh-cream/10 active:bg-oh-cream/15 lg:max-w-xs">
        <Icon name="pin" size={16} className={current ? "shrink-0 text-oh-gold" : "shrink-0 text-oh-cream/60"} />
        <span className="truncate">{name}</span>
        <Icon name="chevron-right" size={14} className="shrink-0 rotate-90 text-oh-cream/60" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Location" size="auto">
        <p className="mb-3 text-sm text-oh-stone/70">Pages show numbers for the location you pick. Saved on this device.</p>
        <div className="overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream divide-y divide-oh-stone/10">
          <ListRow onClick={() => choose("all")} leading={pinTile(locationId === "all")} title="All locations"
            meta="Every store together" trailing={check(locationId === "all")} />
          {locations.map((l) => (
            <ListRow key={l.id} onClick={() => choose(l.id)} leading={pinTile(locationId === l.id)} title={l.name}
              meta={l.city} trailing={check(locationId === l.id)} />
          ))}
        </div>
      </Sheet>
    </>
  );
}
