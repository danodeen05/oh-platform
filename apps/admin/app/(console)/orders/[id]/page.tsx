"use client";
import { use } from "react";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { denverDateTime, money } from "@/lib/format";
import { paymentLabel, paymentTone, podLabel, sourceLabel, type OrderDetail } from "@/lib/orders";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/orders", label: "Orders" };

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-[15px] ${strong ? "font-semibold text-oh-charcoal" : muted ? "text-oh-stone/70" : "text-oh-stone"}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Read-only. Refunds live in Support, owner only. */
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const res = useResource(`order:${id}`, (signal) => api<{ order: OrderDetail }>(`/admin/orders/${encodeURIComponent(id)}`, { signal }), { refreshMs: 30_000 });
  const o = res.data?.order;

  if (!o) {
    const missing = res.error && res.error === "Order not found";
    return (
      <>
        <PageHeader title="Order" back={BACK} />
        {res.error
          ? <ErrorCard message={missing ? "This order doesn't exist." : "Couldn't load this order."} onRetry={missing ? undefined : res.reload} />
          : <div className="space-y-4"><Skeleton className="h-32 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  const subtotal = o.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const card = [o.paymentMethodBrand && sourceLabel(o.paymentMethodBrand), o.paymentMethodLast4 && `ending ${o.paymentMethodLast4}`].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader title={`Order #${o.orderNumber}`} back={BACK}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <span>{[sourceLabel(o.orderSource), o.kitchenOrderNumber && `Kitchen #${o.kitchenOrderNumber}`, denverDateTime(o.createdAt)].filter(Boolean).join(" · ")}</span>
          </span>
        } />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <Card title="Guest">
            <p className="text-[17px] font-semibold text-oh-charcoal">{o.customerName}</p>
            <p className="mt-0.5 text-sm text-oh-stone/70">
              {[o.locationName, podLabel(o) ? `Pod ${podLabel(o)}` : null].filter(Boolean).join(" · ") || "No pod assigned"}
            </p>
            {(o.customerPhone || o.customerEmail) && (
              <div className="-mx-2 mt-2 flex flex-col">
                {o.customerPhone && (
                  <a href={`tel:${o.customerPhone}`} className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[15px] font-semibold text-oh-ember-deep hover:bg-oh-linen">
                    <Icon name="phone" size={18} />{o.customerPhone}
                  </a>
                )}
                {o.customerEmail && (
                  <a href={`mailto:${o.customerEmail}`} className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2 text-[15px] font-semibold text-oh-ember-deep hover:bg-oh-linen">
                    <Icon name="mail" size={18} className="shrink-0" /><span className="truncate">{o.customerEmail}</span>
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card title="Items">
            <ul className="space-y-3">
              {o.items.map((i, n) => (
                <li key={n} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-[15px] text-oh-charcoal"><span className="tabular-nums text-oh-stone/70">{i.quantity} ×</span> {i.name}</span>
                    {i.selectedValue && <span className="block text-sm text-oh-stone/70">{i.selectedValue}</span>}
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-oh-stone">{money(i.priceCents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-oh-stone/15 pt-3">
              <Line label="Subtotal" value={money(subtotal)} muted />
              {!!o.promoDiscountCents && <Line label="Promo" value={`−${money(o.promoDiscountCents)}`} muted />}
              <Line label="Tax" value={money(o.taxCents)} muted />
              <div className="pt-1.5"><Line label="Total" value={money(o.totalCents)} strong /></div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card title="Payment">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Badge>
              <span className="text-[15px] text-oh-stone">{card || "No card on file"}</span>
            </div>
          </Card>

          <Card title="Timeline"><OrderTimeline steps={o.timeline} /></Card>

          <Card title="Pod calls" padded={false}>
            {o.podCalls.length === 0 ? (
              <p className="px-4 py-4 text-[15px] text-oh-stone/70">No pod calls on this order.</p>
            ) : o.podCalls.map((c) => (
              <div key={c.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-oh-charcoal">{sourceLabel(c.reason)}</span>
                  <span className="block text-sm tabular-nums text-oh-stone/70">{denverDateTime(c.createdAt)}</span>
                </span>
                <Badge tone={c.status === "PENDING" ? "alert" : c.status === "ACKNOWLEDGED" ? "pending" : "neutral"}>{sourceLabel(c.status)}</Badge>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
