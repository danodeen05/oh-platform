"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { api } from "@/lib/api";
import { isSpecialDiet, type CateringOrder, type Rsvp } from "@/lib/catering";
import { denverDateTime } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

const SHOWN = 10;

function ShowAllList<T>({ items, showAll, setShowAll, render, empty }: {
  items: T[]; showAll: boolean; setShowAll: (v: boolean) => void; render: (item: T, i: number) => React.ReactNode; empty: string;
}) {
  if (items.length === 0) return <p className="px-4 py-4 text-[15px] text-oh-stone/70">{empty}</p>;
  const shown = showAll ? items : items.slice(0, SHOWN);
  return (
    <>
      {shown.map(render)}
      {items.length > SHOWN && !showAll && (
        <div className="px-4 py-3"><Button size="sm" onClick={() => setShowAll(true)}>Show all {items.length}</Button></div>
      )}
    </>
  );
}

export default function OrdersTab({ eventId, minimumBowls }: { eventId: string; minimumBowls: number }) {
  const res = useResource(`catering-orders:${eventId}`, async (signal) => {
    const [rsvps, orders] = await Promise.all([
      api<Rsvp[]>(`/admin/catering/events/${eventId}/rsvps`, { signal }),
      api<CateringOrder[]>(`/admin/catering/events/${eventId}/orders`, { signal }),
    ]);
    return { rsvps: Array.isArray(rsvps) ? rsvps : [], orders: Array.isArray(orders) ? orders : [] };
  }, { refreshMs: 10_000 });

  const [showAllRsvps, setShowAllRsvps] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);

  if (res.error && !res.data) return <ErrorCard message="Couldn't load orders." onRetry={res.reload} />;
  if (!res.data) return <SkeletonList rows={5} />;

  const { rsvps, orders } = res.data;
  const totalBowls = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const notOrdered = Math.max(0, rsvps.length - orders.length);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="RSVP'd" value={rsvps.length} />
        <StatTile label="Ordered" value={orders.length} tone="good" />
        <StatTile label="Not ordered" value={notOrdered} tone={notOrdered > 0 ? "pending" : "neutral"} />
        <StatTile label="Total bowls" value={totalBowls} hint={`${minimumBowls} min`} tone={totalBowls >= minimumBowls ? "good" : "pending"} />
      </div>

      <Card title={`RSVPs (${rsvps.length})`} padded={false}>
        <ShowAllList items={rsvps} showAll={showAllRsvps} setShowAll={setShowAllRsvps} empty="No RSVPs yet."
          render={(r) => (
            <div key={r.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-oh-charcoal">{r.name}</span>
                <span className="block text-sm text-oh-stone/60">{r.phone || "No phone"}{r.zodiac ? ` · ${r.zodiac}` : ""}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-oh-stone/60">{denverDateTime(r.createdAt)}</span>
            </div>
          )} />
      </Card>

      <Card title={`Orders (${orders.length})`} padded={false}>
        <ShowAllList items={orders} showAll={showAllOrders} setShowAll={setShowAllOrders} empty="No orders yet."
          render={(o) => (
            <div key={o.id} className="flex min-h-14 flex-col gap-1 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[15px] font-semibold text-oh-charcoal">{o.guestName || o.guest?.name || "Guest"}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {isSpecialDiet(o) && <Badge tone="alert">Special diet</Badge>}
                  <span className="text-sm tabular-nums text-oh-stone/60">{denverDateTime(o.createdAt)}</span>
                </span>
              </div>
              <p className="text-sm text-oh-stone/70">
                {o.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.menuItem?.name || ""}${i.selectedValue ? ` (${i.selectedValue})` : ""}`).join(", ")}
              </p>
            </div>
          )} />
      </Card>

      <p className="text-sm text-oh-stone/60">Updates every 10 seconds.</p>
    </div>
  );
}
