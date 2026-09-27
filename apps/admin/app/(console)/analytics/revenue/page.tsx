"use client";
import { useState } from "react";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { API_BASE, api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";
import { PeriodSelector } from "../components/PeriodSelector";
import { SimpleBarChart, type BarPoint } from "../components/SimpleBarChart";

type GroupBy = "hour" | "day" | "week" | "month";

type RevenueData = {
  summary: { totalRevenue: number; totalRevenueFormatted: string; totalOrders: number; averageOrderValue: number; averageOrderValueFormatted: string };
  timeline: Array<{ date: string; revenue: number; revenueFormatted: string; orders: number }>;
  byLocation: Array<{ locationId: string; name: string; revenue: number; revenueFormatted: string; orders: number }>;
};

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const timelineLabel = (date: string) => (date.includes(" ") ? date.split(" ")[1] : date.split("-").slice(1).join("/"));

export default function RevenuePage() {
  const [period, setPeriod] = useState<Period>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const res = useResource(`revenue:${period}:${groupBy}`, (signal) => api<RevenueData>("/analytics/revenue", { signal, query: { period, groupBy } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;

  const revenueChart: BarPoint[] = res.data?.timeline.map((t) => ({ label: timelineLabel(t.date), value: t.revenue / 100, formatted: t.revenueFormatted })) ?? [];
  const ordersChart: BarPoint[] = res.data?.timeline.map((t) => ({ label: timelineLabel(t.date), value: t.orders, formatted: `${t.orders} orders` })) ?? [];
  const locationRows = res.data?.byLocation.map((l) => ({
    name: l.name, revenue: l.revenueFormatted, orders: l.orders,
    avgOrder: l.orders > 0 ? money(l.revenue / l.orders) : money(0),
  })) ?? [];

  return (
    <>
      <PageHeader title="Revenue" subtitle="Trends, locations and sales patterns." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load revenue.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !res.data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Total revenue" value={res.data.summary.totalRevenueFormatted} />
              <StatTile label="Total orders" value={res.data.summary.totalOrders} />
              <StatTile label="Average order" value={res.data.summary.averageOrderValueFormatted} />
              <StatTile label="Revenue per order" value={res.data.summary.totalOrders > 0 ? money(res.data.summary.totalRevenue / res.data.summary.totalOrders) : money(0)} />
            </div>
            <SegmentedControl<GroupBy> label="Group by" value={groupBy} onChange={setGroupBy} options={GROUP_OPTIONS} />
            <SimpleBarChart title={`Revenue by ${groupBy}`} data={revenueChart} />
            <DataTable title="Revenue by location" rows={locationRows}
              columns={[
                { key: "name", label: "Location" },
                { key: "revenue", label: "Revenue", align: "right" },
                { key: "orders", label: "Orders", align: "right" },
                { key: "avgOrder", label: "Avg order", align: "right" },
              ]} />
            <SimpleBarChart title="Orders over time" data={ordersChart} />
          </>
        )}
      </div>
    </>
  );
}
