"use client";
import { useState } from "react";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { API_BASE, api } from "@/lib/api";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";
import { PeriodSelector } from "../components/PeriodSelector";
import { SimpleBarChart, type BarPoint } from "../components/SimpleBarChart";

type MenuItemStat = { id: string; name: string; category: string; quantity: number; revenueFormatted: string };
type MenuData = {
  summary: { totalItemsSold: number; totalRevenue: number; totalRevenueFormatted: string; uniqueItems: number };
  topByQuantity: MenuItemStat[];
  topByRevenue: MenuItemStat[];
  byCategory: Array<{ category: string; quantity: number; revenue: number; revenueFormatted: string; percentOfRevenue: string }>;
};

const EMPTY: MenuData = {
  summary: { totalItemsSold: 0, totalRevenue: 0, totalRevenueFormatted: "$0.00", uniqueItems: 0 },
  topByQuantity: [], topByRevenue: [], byCategory: [],
};

export default function MenuPage() {
  const [period, setPeriod] = useState<Period>("week");
  const res = useResource(`menu:${period}`, async (signal) => {
    const data = await api<Partial<MenuData>>("/analytics/menu", { signal, query: { period } });
    return data.summary ? (data as MenuData) : EMPTY;
  });
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;
  const data = res.data;

  const categoryChart: BarPoint[] = data?.byCategory.map((c) => ({ label: c.category, value: c.revenue / 100, formatted: c.revenueFormatted })) ?? [];
  const avgItemsPerOrder = data && data.summary.totalItemsSold > 0 ? (data.summary.totalItemsSold / Math.max(1, data.topByQuantity.length)).toFixed(1) : "0";

  return (
    <>
      <PageHeader title="Menu" subtitle="Item popularity and category performance." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load menu performance.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Items sold" value={data.summary.totalItemsSold.toLocaleString()} />
              <StatTile label="Menu revenue" value={data.summary.totalRevenueFormatted} />
              <StatTile label="Unique items" value={data.summary.uniqueItems} />
              <StatTile label="Avg items per order" value={avgItemsPerOrder} />
            </div>
            <SimpleBarChart title="Revenue by category" data={categoryChart} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DataTable title="Top items by quantity" rows={data.topByQuantity}
                columns={[
                  { key: "name", label: "Item" },
                  { key: "category", label: "Category" },
                  { key: "quantity", label: "Qty", align: "right" },
                  { key: "revenueFormatted", label: "Revenue", align: "right" },
                ]} />
              <DataTable title="Top items by revenue" rows={data.topByRevenue}
                columns={[
                  { key: "name", label: "Item" },
                  { key: "category", label: "Category" },
                  { key: "quantity", label: "Qty", align: "right" },
                  { key: "revenueFormatted", label: "Revenue", align: "right" },
                ]} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
