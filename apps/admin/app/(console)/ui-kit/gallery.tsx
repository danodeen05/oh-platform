"use client";
import { useState, type ReactNode } from "react";
import {
  Badge, Button, Card, EmptyState, ErrorCard, Icon, ICON_NAMES, IconButton, LinkButton, ListRow, PageHeader,
  Skeleton, SkeletonList, StatTile,
} from "@/components/ui";

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
    </div>
  );
}
