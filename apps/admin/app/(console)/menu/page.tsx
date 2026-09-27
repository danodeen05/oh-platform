"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MenuItemSheet } from "@/components/menu/MenuItemSheet";
import { MenuList } from "@/components/menu/MenuList";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE } from "@/lib/api";
import { filterMenu, groupMenu, type MenuFilter, type MenuItem, type Tenant } from "@/lib/menu";
import { runOptimistic } from "@/lib/optimistic";
import { useResource } from "@/lib/use-resource";

type Data = { items: MenuItem[]; tenants: Tenant[] };

export default function MenuPage() {
  const { show } = useToast();
  const res = useResource<Data>(API_BASE ? "menu" : null, async (signal) => {
    const [menu, tenants] = await Promise.all([
      api<{ items: MenuItem[] }>("/admin/menu", { signal }),
      api<Tenant[]>("/tenants", { signal }),
    ]);
    return { items: menu.items, tenants: Array.isArray(tenants) ? tenants : [] };
  });
  const [items, setItems] = useState<MenuItem[] | null>(null);
  useEffect(() => { if (res.data) setItems(res.data.items); }, [res.data]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MenuFilter>("all");
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<{ item: MenuItem | null } | null>(null);

  // Today's "Mark item sold out" lands here with ?focus=search.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") !== "search") return;
    const id = requestAnimationFrame(() => document.querySelector<HTMLInputElement>('main input[type="search"]')?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const tenants = res.data?.tenants ?? [];
  const defaultTenant = tenants.find((t) => t.slug === "oh") ?? tenants[0];
  const shown = useMemo(() => (items ? groupMenu(filterMenu(items, query, filter)) : []), [items, query, filter]);
  const soldOut = items?.filter((i) => !i.isAvailable).length ?? 0;

  const setAvailable = (id: string, v: boolean) => setItems((list) => list && list.map((i) => (i.id === id ? { ...i, isAvailable: v } : i)));
  const markBusy = (id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const flip = useCallback(async function flip(item: MenuItem, next: boolean, isUndo = false) {
    markBusy(item.id, true);
    const ok = await runOptimistic({
      apply: () => setAvailable(item.id, next),
      revert: () => setAvailable(item.id, !next),
      commit: () => api(`/menu/${item.id}`, { method: "PATCH", body: { isAvailable: next } }),
    });
    markBusy(item.id, false);
    if (!ok) { show({ message: `Couldn't update ${item.name}. Try again.`, tone: "alert" }); return; }
    show({
      message: next ? `${item.name} is back on` : `${item.name} is sold out`,
      tone: next ? "good" : "info",
      // Undo is only offered for a change the server accepted, and never for an undo.
      action: isUndo ? undefined : { label: "Undo", onClick: () => { flip(item, !next, true); } },
      durationMs: isUndo ? undefined : 5000,
    });
  }, [show]);

  if (!API_BASE) return (<><PageHeader title="Menu" /><ErrorCard message="Missing NEXT_PUBLIC_API_URL" /></>);

  const brand = defaultTenant?.brandName;
  const summary = items ? [brand, `${items.length} ${items.length === 1 ? "item" : "items"}`, soldOut ? `${soldOut} sold out` : null].filter(Boolean).join(" · ") : undefined;

  return (
    <>
      <PageHeader title="Menu" subtitle={summary}
        actions={<Button variant="primary" icon="plus" onClick={() => setSheet({ item: null })} disabled={!res.data}>New item</Button>} />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 space-y-2 bg-oh-paper/95 px-4 py-2 backdrop-blur-sm lg:-mx-8 lg:flex lg:items-center lg:gap-3 lg:space-y-0 lg:px-8">
        <div className="lg:max-w-md lg:flex-1">
          <SearchField value={query} onChange={setQuery} placeholder="Search items or categories" label="Search the menu" />
        </div>
        <FilterChips<MenuFilter> label="Show" value={filter} onChange={setFilter}
          options={[{ value: "all", label: "All", count: items?.length }, { value: "soldOut", label: "Sold out", count: soldOut }]} />
      </div>

      {res.error && !items ? (
        <ErrorCard message="Couldn't load the menu." onRetry={res.reload} />
      ) : !items ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState icon="bowl" title="No menu items yet" body="Add the first item to start taking orders."
          action={<Button variant="primary" icon="plus" onClick={() => setSheet({ item: null })}>New item</Button>} />
      ) : shown.length === 0 ? (
        filter === "soldOut" && !query.trim()
          ? <EmptyState icon="check" title="Nothing is sold out" body="Every item is available." />
          : <EmptyState icon="search" title="No items match" body="Try a different name or category." />
      ) : (
        <MenuList groups={shown} busy={busy} onToggle={(item, next) => flip(item, next)} onOpen={(item) => setSheet({ item })} />
      )}

      {sheet && (
        <MenuItemSheet key={sheet.item?.id ?? "new"} open item={sheet.item} tenants={tenants} defaultTenantId={defaultTenant?.id ?? ""}
          onClose={() => setSheet(null)}
          onSaved={(saved, created) => {
            setItems((list) => list && (created ? [...list, saved] : list.map((i) => (i.id === saved.id ? { ...i, ...saved } : i))));
            setSheet(null);
            show({ message: created ? `${saved.name} added` : `${saved.name} saved`, tone: "good" });
          }}
          onDeleted={(id) => {
            const name = items?.find((i) => i.id === id)?.name ?? "Item";
            setItems((list) => list && list.filter((i) => i.id !== id));
            setSheet(null);
            show({ message: `${name} deleted`, tone: "info" });
          }} />
      )}
    </>
  );
}
