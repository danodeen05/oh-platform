"use client";
import { useEffect, useState } from "react";
import { OrdersTabs } from "@/components/orders/OrdersTabs";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useLocationFilter } from "@/components/providers/LocationProvider";
import { Badge } from "@/components/ui/Badge";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { money, relativeTime } from "@/lib/format";
import { orderMeta, orderTitle, paymentLabel, paymentTone, type OrderSummary } from "@/lib/orders";
import { useResource } from "@/lib/use-resource";
import Link from "next/link";

const COLUMNS: Column<OrderSummary>[] = [
  { key: "order", label: "Order", render: (o) => (
    <Link href={`/orders/${o.id}`} className="font-semibold text-oh-charcoal underline-offset-4 hover:underline">{orderTitle(o)}</Link>
  ) },
  { key: "customer", label: "Customer", render: (o) => (
    <span>{o.customerName}{o.phoneLast4 && <span className="ml-1.5 text-oh-stone/60 tabular-nums">…{o.phoneLast4}</span>}</span>
  ) },
  { key: "location", label: "Location", render: (o) => o.locationName ?? <span className="text-oh-ash">None</span> },
  { key: "pod", label: "Pod", render: (o) => (o.seatNumber != null ? <span className="tabular-nums">{o.seatNumber}</span> : <span className="text-oh-ash">None</span>) },
  { key: "status", label: "Status", render: (o) => <OrderStatusBadge status={o.status} /> },
  { key: "payment", label: "Payment", render: (o) => <Badge tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Badge> },
  { key: "total", label: "Total", align: "right", render: (o) => money(o.totalCents) },
  { key: "time", label: "Time", align: "right", render: (o) => <span className="whitespace-nowrap text-oh-stone/70">{relativeTime(o.createdAt)}</span> },
];

export default function OrdersPage() {
  const { locationId } = useLocationFilter();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  const res = useResource(`orders:${locationId}:${q}`,
    (signal) => api<{ orders: OrderSummary[] }>("/admin/orders", { signal, query: { q, locationId, limit: 50 } }),
    { refreshMs: q ? undefined : 30_000 });
  const orders = res.data?.orders;

  return (
    <>
      <PageHeader title="Orders" />
      <div className="space-y-4">
        <OrdersTabs current="dine-in">
          <SearchField value={text} onChange={setText} onSubmit={(v) => setQ(v.trim())} placeholder="Name, phone or order number" label="Find an order" />
        </OrdersTabs>

        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">{q ? "Results" : "Today"}</h2>
          {orders && <span className="text-sm tabular-nums text-oh-stone/60">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>}
        </div>

        {res.error && !orders ? (
          <ErrorCard message="Couldn't load orders." onRetry={res.reload} />
        ) : !orders ? (
          <SkeletonList rows={5} />
        ) : (
          <DataList rows={orders} rowKey={(o) => o.id} columns={COLUMNS}
            empty={q
              ? <EmptyState icon="search" title="No orders match" body="Try the last 4 digits of their phone." />
              : <EmptyState icon="receipt" title="No orders yet today" body="Dine-in orders show up here as they come in." />}
            renderCard={(o) => (
              <ListRow href={`/orders/${o.id}`} title={orderTitle(o)} meta={orderMeta(o)} chevron={false}
                trailing={
                  <span className="flex flex-col items-end gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    <span className="text-sm font-semibold tabular-nums text-oh-charcoal">{money(o.totalCents)}</span>
                  </span>
                } />
            )} />
        )}
      </div>
    </>
  );
}
