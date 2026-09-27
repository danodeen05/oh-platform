"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OrdersTabs } from "@/components/orders/OrdersTabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { controlCls, Field, Select } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useRole } from "@/components/providers/RoleProvider";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import {
  customerEmail, customerName, denverDayRange, fulfillmentLabel, fulfillmentTone, itemsSummary,
  pageSummary, paymentLabel, paymentTone, typeLabel, FULFILLMENT_STATUSES, FULFILLMENT_TYPES, PAYMENT_STATUSES,
  type Pagination, type ShopOrderStats, type ShopOrderSummary,
} from "@/lib/shop-orders";
import { useResource } from "@/lib/use-resource";

const LIMIT = 20;
const EMPTY_PAGE: Pagination = { page: 1, limit: LIMIT, totalCount: 0, totalPages: 0 };

type Filters = { paymentStatus: string; fulfillmentStatus: string; fulfillmentType: string; startDate: string; endDate: string };
const EMPTY_FILTERS: Filters = { paymentStatus: "", fulfillmentStatus: "", fulfillmentType: "", startDate: "", endDate: "" };

const COLUMNS: Column<ShopOrderSummary>[] = [
  { key: "order", label: "Order", render: (o) => (
    <>
      <Link href={`/shop-orders/${o.id}`} className="font-semibold text-oh-charcoal underline-offset-4 hover:underline">#{o.orderNumber}</Link>
      <span className="block text-sm text-oh-stone/60">{shortDate(o.createdAt)}</span>
    </>
  ) },
  { key: "customer", label: "Customer", render: (o) => (
    <>
      <span className="block">{customerName(o)}</span>
      {customerEmail(o) && <span className="block text-sm text-oh-stone/60">{customerEmail(o)}</span>}
    </>
  ) },
  { key: "items", label: "Items", render: (o) => <span title={itemsSummary(o.items)} className="block max-w-xs truncate text-sm">{itemsSummary(o.items)}</span> },
  { key: "total", label: "Total", align: "right", render: (o) => <span className="font-semibold">{money(o.totalCents)}</span> },
  { key: "payment", label: "Payment", render: (o) => <Badge tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Badge> },
  { key: "fulfillment", label: "Fulfillment", render: (o) => (
    <>
      <Badge tone={fulfillmentTone(o.fulfillmentStatus)}>{fulfillmentLabel(o.fulfillmentStatus)}</Badge>
      {o.trackingNumber && <span className="mt-1 block font-mono text-xs text-oh-stone/60">{o.trackingNumber}</span>}
    </>
  ) },
  { key: "type", label: "Type", render: (o) => typeLabel(o.fulfillmentType) },
];

export default function ShopOrdersPage() {
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Filters can arrive from elsewhere ("?fulfillmentStatus=PENDING" from Today, or the
  // page's own Pending fulfillment tile). Reactive to searchParams, not just on mount, so
  // tapping that tile while already on this page updates the select too.
  useEffect(() => {
    const fulfillmentStatus = searchParams.get("fulfillmentStatus");
    if (fulfillmentStatus) setFilters((f) => (f.fulfillmentStatus === fulfillmentStatus ? f : { ...f, fulfillmentStatus }));
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [filters, q]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const activeCount = Object.values(filters).filter(Boolean).length;
  const clear = () => {
    setFilters(EMPTY_FILTERS); setText(""); setQ("");
    if (searchParams.toString()) router.replace(pathname);
  };

  const key = `shop-orders:${JSON.stringify(filters)}:${q}:${page}`;
  const res = useResource(key, (signal) => api<{ orders: ShopOrderSummary[]; pagination: Pagination }>("/admin/shop/orders", {
    signal, query: { page, limit: LIMIT, search: q || undefined, ...filters },
  }));

  const statsRes = useResource("shop-orders:stats", (signal) => api<ShopOrderStats>("/admin/shop/orders/stats", { signal }));
  const todayRange = useMemo(() => denverDayRange(), []);
  const todayRes = useResource("shop-orders:stats:today", (signal) => api<ShopOrderStats>("/admin/shop/orders/stats", { signal, query: todayRange }));

  const orders = res.data?.orders;
  const pagination = res.data?.pagination ?? EMPTY_PAGE;

  return (
    <>
      <PageHeader title="Shop orders" />
      <div className="space-y-4">
        <OrdersTabs current="shop" />

        <div className={`grid grid-cols-2 gap-3 ${role === "owner" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <StatTile label="Total" value={statsRes.data ? statsRes.data.totalOrders : "…"} />
          <StatTile label="Pending fulfillment" value={statsRes.data ? statsRes.data.byStatus.pending : "…"}
            href="/shop-orders?fulfillmentStatus=PENDING" tone={statsRes.data && statsRes.data.byStatus.pending > 0 ? "pending" : "neutral"} />
          <StatTile label="Today" value={todayRes.data ? todayRes.data.totalOrders : "…"} />
          {role === "owner" && <StatTile label="Revenue" value={statsRes.data ? money(statsRes.data.totalRevenueCents) : "…"} tone="good" />}
        </div>

        <SearchField value={text} onChange={(v) => { setText(v); if (!v) setQ(""); }} onSubmit={(v) => setQ(v.trim())} placeholder="Order #, email, name" label="Search shop orders" />

        <FilterBar activeCount={activeCount} onClear={clear}>
          <Field label="Payment status" className="lg:w-44">
            <Select value={filters.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>
              <option value="">All</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{paymentLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Fulfillment status" className="lg:w-48">
            <Select value={filters.fulfillmentStatus} onChange={(e) => set("fulfillmentStatus", e.target.value)}>
              <option value="">All</option>
              {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{fulfillmentLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Type" className="lg:w-44">
            <Select value={filters.fulfillmentType} onChange={(e) => set("fulfillmentType", e.target.value)}>
              <option value="">All</option>
              {FULFILLMENT_TYPES.map((s) => <option key={s} value={s}>{typeLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Start date" className="lg:w-40">
            <input type="date" value={filters.startDate} onChange={(e) => set("startDate", e.target.value)} className={controlCls} />
          </Field>
          <Field label="End date" className="lg:w-40">
            <input type="date" value={filters.endDate} onChange={(e) => set("endDate", e.target.value)} className={controlCls} />
          </Field>
          <Button variant="ghost" onClick={clear} className="hidden lg:inline-flex">Clear</Button>
        </FilterBar>

        {res.error && !orders ? (
          <ErrorCard message="Couldn't load shop orders." onRetry={res.reload} />
        ) : !orders ? (
          <SkeletonList rows={6} />
        ) : (
          <DataList rows={orders} rowKey={(o) => o.id} columns={COLUMNS}
            empty={<EmptyState icon="bag" title="No orders found" body="Try different filters or clear them." />}
            renderCard={(o) => (
              <Link href={`/shop-orders/${o.id}`} className="block px-4 py-3 transition-colors hover:bg-oh-linen/60 active:bg-oh-linen">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block font-semibold text-oh-charcoal">#{o.orderNumber}</span>
                    <span className="block text-sm text-oh-stone/60">{shortDate(o.createdAt)}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-oh-charcoal">{money(o.totalCents)}</span>
                </div>
                <p className="mt-1.5 truncate text-sm text-oh-stone">{customerName(o)}{customerEmail(o) && <span className="text-oh-stone/60"> · {customerEmail(o)}</span>}</p>
                <p className="mt-0.5 truncate text-sm text-oh-stone/60">{itemsSummary(o.items)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Badge>
                  <Badge tone={fulfillmentTone(o.fulfillmentStatus)}>{fulfillmentLabel(o.fulfillmentStatus)}</Badge>
                  <span className="text-sm text-oh-stone/70">{typeLabel(o.fulfillmentType)}</span>
                  {o.trackingNumber && <span className="font-mono text-xs text-oh-stone/60">{o.trackingNumber}</span>}
                </div>
              </Link>
            )} />
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={pagination.page <= 1}>Previous</Button>
            <span className="text-sm tabular-nums text-oh-stone/70">{pageSummary(pagination)}</span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={pagination.page >= pagination.totalPages}>Next</Button>
          </div>
        )}
      </div>
    </>
  );
}
