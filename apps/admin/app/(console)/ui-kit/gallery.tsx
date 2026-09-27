"use client";
import { useState, type ReactNode } from "react";
import {
  Badge, Button, Card, ConfirmProvider, DataList, EmptyState, ErrorCard, Field, FilterChips, Icon, ICON_NAMES, IconButton,
  LinkButton, ListRow, MoneyInput, NumberInput, PageHeader, SearchField, SegmentedControl, Select, Sheet, Skeleton,
  SkeletonList, StatTile, TextArea, TextInput, Toggle, ToastProvider, useConfirm, useToast, type Column,
} from "@/components/ui";

type Item = { id: string; name: string; station: string; price: number; soldOut: boolean };
const ITEMS: Item[] = [
  { id: "a", name: "Oh! Beef Noodle Soup", station: "Soup", price: 1695, soldOut: false },
  { id: "b", name: "Spicy Braised Short Rib Bowl", station: "Soup", price: 1895, soldOut: true },
  { id: "c", name: "Scallion Pancake", station: "Sides", price: 650, soldOut: false },
  { id: "d", name: "Smashed Cucumber", station: "Sides", price: 550, soldOut: false },
];
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-oh-clay">{title}</h2>
        <span className="h-px flex-1 bg-oh-stone/15" aria-hidden="true" />
      </div>
      {note && <p className="-mt-1 mb-3 text-sm text-oh-stone/70">{note}</p>}
      {children}
    </section>
  );
}

export function Gallery() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Kit />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Kit() {
  const toast = useToast();
  const ask = useConfirm();
  const [period, setPeriod] = useState("today");
  const [tab, setTab] = useState("details");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [cents, setCents] = useState<number | null>(1695);
  const [orderNow, setOrderNow] = useState(true);
  const [items, setItems] = useState(ITEMS);
  const [sheet, setSheet] = useState<"full" | "auto" | null>(null);
  const [lastConfirm, setLastConfirm] = useState<string | null>(null);

  const setSoldOut = (id: string, soldOut: boolean) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, soldOut } : x)));
  const toggleSoldOut = (it: Item) => {
    setSoldOut(it.id, !it.soldOut);
    toast.show({ message: `${it.name} is ${it.soldOut ? "back on" : "sold out"}.`, tone: "good", action: { label: "Undo", onClick: () => setSoldOut(it.id, it.soldOut) } });
  };
  const shown = items
    .filter((x) => filter === "all" || (filter === "out" ? x.soldOut : !x.soldOut))
    .filter((x) => x.name.toLowerCase().includes(query.trim().toLowerCase()));
  const columns: Column<Item>[] = [
    { key: "name", label: "Item", render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "station", label: "Station", render: (r) => <span className="text-oh-stone/75">{r.station}</span> },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.soldOut ? "alert" : "good"}>{r.soldOut ? "Sold out" : "Available"}</Badge> },
    { key: "price", label: "Price", align: "right", render: (r) => money(r.price) },
    { key: "on", label: "On menu", align: "right", render: (r) => <Toggle checked={!r.soldOut} onChange={() => toggleSoldOut(r)} label={`${r.name} available`} hideLabel /> },
  ];

  const [retries, setRetries] = useState(0);
  const [tapped, setTapped] = useState<string | null>(null);

  return (
    <div className="oh-console min-h-svh bg-oh-paper">
      <div className="bg-oh-charcoal pt-[max(16px,env(safe-area-inset-top))] pb-5 text-oh-cream">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oh-gold">Oh! Admin</p>
          <p className="mt-1 font-display text-[2.25rem] leading-none">UI kit</p>
          <p className="mt-2 text-sm text-oh-cream/65">Every console component, in every state. Dev only.</p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-9 px-4 py-6 lg:py-8">
        <Section id="header" title="Page header">
          <PageHeader title="Promo codes" subtitle="12 active, 3 scheduled" back={{ href: "/ui-kit", label: "Sell" }}
            actions={<Button variant="primary" icon="plus">New code</Button>} />
        </Section>

        <Section id="buttons" title="Buttons" note="Every target is at least 44px tall.">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Save changes</Button>
              <Button>Cancel</Button>
              <Button variant="ghost">Skip</Button>
              <Button variant="danger" icon="trash">Delete</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="check" size="sm">Mark ready</Button>
              <Button size="sm" icon="copy">Copy link</Button>
              <Button variant="primary" loading>Saving</Button>
              <Button disabled>Disabled</Button>
              <LinkButton href="/ui-kit" icon="external" variant="ghost">Open site</LinkButton>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <IconButton icon="search" label="Search" />
              <IconButton icon="filter" label="Filter" />
              <IconButton icon="edit" label="Edit" />
              <IconButton icon="more" label="More" />
              <span className="ml-2 inline-flex rounded-xl bg-oh-charcoal text-oh-cream">
                <IconButton icon="close" label="Close" className="hover:bg-oh-cream/10" />
              </span>
            </div>
          </div>
        </Section>

        <Section id="badges" title="Badges" note="Status is always a word plus a dot.">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Draft</Badge>
            <Badge tone="good">Live</Badge>
            <Badge tone="pending">Scheduled</Badge>
            <Badge tone="alert">Sold out</Badge>
            <Badge tone="info">Pickup</Badge>
          </div>
        </Section>

        <Section id="stats" title="Stat tiles">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Orders" value="128" hint="+14 vs last Sat" />
            <StatTile label="Net sales" value="$3,482" tone="good" hint="Ahead of pace" href="/ui-kit" />
            <StatTile label="Avg ticket" value="$18.40" tone="pending" hint="Under target" />
            <StatTile label="Sold out" value="3" tone="alert" hint="Tap to review" href="/ui-kit" />
          </div>
        </Section>

        <div className="grid gap-9 lg:grid-cols-2 lg:gap-6">
          <Section id="rows" title="Card with list rows">
            <Card title="Open orders" padded={false} action={<Button variant="ghost" size="sm">See all</Button>}>
              <ListRow href="/ui-kit" title="Order 1042, Maya R."
                meta="SoHo, 2 bowls, picked up 12:41" trailing={<Badge tone="good">Paid</Badge>}
                leading={<span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-oh-linen text-oh-stone"><Icon name="receipt" size={18} /></span>} />
              <ListRow onClick={() => setTapped("1043")} title="Order 1043, Jordan P." meta="City Creek, dine-in seat 14"
                trailing={<span className="text-[15px] font-semibold tabular-nums">$24.10</span>} chevron
                leading={<span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-oh-linen text-oh-stone"><Icon name="seat" size={18} /></span>} />
              <ListRow title="A very long title that should truncate gracefully instead of wrapping onto the next line"
                meta="Static row, no action" trailing={<Badge tone="pending">Waiting</Badge>} />
            </Card>
            {tapped && <p className="mt-2 text-sm text-oh-stone/70">Tapped order {tapped}.</p>}
          </Section>

          <Section id="card" title="Padded card">
            <Card title="Order Now" action={<Badge tone="good">On</Badge>}>
              <p className="text-[15px] leading-relaxed text-oh-stone">
                Guests can order from their seat at every location. Turn this off to pause new dine-in orders.
              </p>
            </Card>
          </Section>
        </div>

        <div className="grid gap-9 lg:grid-cols-2 lg:gap-6">
          <Section id="empty" title="Empty state">
            <Card padded={false}>
              <EmptyState icon="tag" title="No promo codes yet" body="Codes you create show up here, with their usage and limits."
                action={<Button variant="primary" icon="plus">New code</Button>} />
            </Card>
          </Section>

          <Section id="error" title="Error and loading">
            <div className="space-y-3">
              <ErrorCard message={retries ? `Still offline. Tried ${retries} time${retries > 1 ? "s" : ""}.` : "Could not load orders."}
                onRetry={() => setRetries((n) => n + 1)} />
              <ErrorCard message="This location is no longer available." />
              <SkeletonList rows={3} />
              <div className="flex gap-3">
                <Skeleton className="h-24 flex-1 rounded-card" />
                <Skeleton className="h-24 flex-1 rounded-card" />
              </div>
            </div>
          </Section>
        </div>

        <Section id="forms" title="Form fields" note="44px controls, 16px text so iOS never zooms.">
          <Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Code" hint="Guests type this at checkout.">
                <TextInput placeholder="NOODLES10" autoCapitalize="characters" />
              </Field>
              <Field label="Price" hint={cents === null ? "Enter an amount." : `Saved as ${cents} cents.`}>
                <MoneyInput cents={cents} onCents={setCents} />
              </Field>
              <Field label="Uses per guest">
                <NumberInput defaultValue="1" />
              </Field>
              <Field label="Location">
                <Select defaultValue="soho">
                  <option value="all">All locations</option>
                  <option value="soho">SoHo</option>
                  <option value="city-creek">City Creek</option>
                  <option value="university">University Place</option>
                </Select>
              </Field>
              <Field label="Email" error="That email is missing an @.">
                <TextInput type="email" defaultValue="maya.example.com" aria-invalid="true" />
              </Field>
              <Field label="Note for the kitchen" className="lg:row-span-2">
                <TextArea placeholder="Optional" />
              </Field>
              <div className="flex flex-col gap-1">
                <Toggle checked={orderNow} onChange={setOrderNow} label="Order Now" />
                <Toggle checked={false} onChange={() => {}} label="Catering (locked)" disabled />
              </div>
            </div>
          </Card>
        </Section>

        <div className="grid gap-9 lg:grid-cols-2 lg:gap-6">
          <Section id="segmented" title="Segmented control">
            <div className="space-y-3">
              <SegmentedControl label="Period" value={period} onChange={setPeriod}
                options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
              <SegmentedControl label="Sections" scroll value={tab} onChange={setTab}
                options={[
                  { value: "details", label: "Details" }, { value: "guests", label: "Guests" }, { value: "menu", label: "Menu" },
                  { value: "payments", label: "Payments" }, { value: "messages", label: "Messages" }, { value: "history", label: "History" },
                ]} />
            </div>
          </Section>

          <Section id="overlays" title="Sheet, confirm and toast" note="Drag a sheet's header down to close it on a phone.">
            <div className="flex flex-wrap gap-2">
              <Button icon="edit" onClick={() => setSheet("full")}>Edit item</Button>
              <Button icon="filter" onClick={() => setSheet("auto")}>Filters</Button>
              <Button variant="danger" icon="trash" onClick={async () => {
                const ok = await ask({ title: "Delete this promo?", body: "Guests who have not used NOODLES10 lose it. This cannot be undone.", confirmLabel: "Delete promo", tone: "danger" });
                setLastConfirm(ok ? "Deleted." : "Kept.");
                if (ok) toast.show({ message: "Promo deleted.", tone: "alert" });
              }}>Delete promo</Button>
              <Button onClick={() => toast.show({ message: "Saved." , tone: "good" })}>Toast</Button>
              <Button onClick={() => toast.show({ message: "Could not reach the kitchen. Check the tablet.", tone: "alert" })}>Error toast</Button>
            </div>
            {lastConfirm && <p className="mt-2 text-sm text-oh-stone/70">Confirm answered: {lastConfirm}</p>}
          </Section>
        </div>

        <Section id="datalist" title="Search, filters and data list" note="Cards on a phone, a table from 1024px.">
          <div className="space-y-3">
            <SearchField value={query} onChange={setQuery} placeholder="Search the menu" />
            <FilterChips label="Filter" value={filter} onChange={setFilter}
              options={[
                { value: "all", label: "All", count: items.length },
                { value: "on", label: "Available", count: items.filter((x) => !x.soldOut).length },
                { value: "out", label: "Sold out", count: items.filter((x) => x.soldOut).length },
              ]} />
            <DataList rows={shown} rowKey={(r) => r.id} columns={columns}
              renderCard={(r) => (
                <ListRow title={r.name} meta={`${r.station}, ${money(r.price)}`}
                  trailing={<Toggle checked={!r.soldOut} onChange={() => toggleSoldOut(r)} label={`${r.name} available`} hideLabel />} />
              )}
              empty={<Card padded={false}><EmptyState icon="search" title="Nothing matches" body="Try a shorter search or another filter."
                action={<Button onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>} /></Card>} />
          </div>
        </Section>

        <Section id="icons" title="Icons" note="24px grid, 1.5px stroke, drawn in-house.">
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-9">
            {ICON_NAMES.map((n) => (
              <div key={n} className="flex flex-col items-center gap-1.5 rounded-xl border border-oh-stone/10 bg-oh-cream px-1 py-3 text-oh-charcoal">
                <Icon name={n} />
                <span className="max-w-full truncate text-[11px] text-oh-stone/70">{n}</span>
              </div>
            ))}
          </div>
        </Section>
      </main>
      <Sheet open={sheet === "full"} onClose={() => setSheet(null)} title="Oh! Beef Noodle Soup"
        footer={<div className="flex gap-2"><Button className="flex-1" onClick={() => setSheet(null)}>Cancel</Button>
          <Button className="flex-1" variant="primary" onClick={() => { setSheet(null); toast.show({ message: "Item saved.", tone: "good" }); }}>Save</Button></div>}>
        <div className="space-y-4">
          <Field label="Name"><TextInput defaultValue="Oh! Beef Noodle Soup" /></Field>
          <Field label="Price"><MoneyInput cents={1695} onCents={() => {}} /></Field>
          <Field label="Description"><TextArea defaultValue="Eight-hour beef broth, hand-pulled noodles, braised shank, pickled mustard greens." /></Field>
          <Toggle checked={orderNow} onChange={setOrderNow} label="Available today" />
          <p className="pt-2 text-sm text-oh-stone/70">The body scrolls on its own while the header and footer stay put.</p>
        </div>
      </Sheet>
      <Sheet open={sheet === "auto"} onClose={() => setSheet(null)} title="Filters" size="auto"
        footer={<Button variant="primary" className="w-full" onClick={() => setSheet(null)}>Show results</Button>}>
        <div className="space-y-4">
          <Field label="Location"><Select defaultValue="all"><option value="all">All locations</option><option>SoHo</option></Select></Field>
          <FilterChips value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "on", label: "Available" }, { value: "out", label: "Sold out" }]} />
        </div>
      </Sheet>
    </div>
  );
}
