"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { API_BASE, api } from "@/lib/api";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";
import { PeriodSelector } from "../components/PeriodSelector";

type ItemStat = { name: string; category: string; quantity: number; revenueFormatted: string; orderCount: number };
type UpsellingData = {
  summary: { totalAddOnOrders: number; totalAddOnRevenueFormatted: string; ordersWithAddons: number; totalParentOrders: number; conversionRate: string; averageAddOnValue: string };
  byType: Array<{ type: string; label: string; emoji: string; count: number; revenueFormatted: string }>;
  topByPopularity: ItemStat[];
  topByRevenue: ItemStat[];
};

export default function UpsellingPage() {
  const [period, setPeriod] = useState<Period>("week");
  const res = useResource(`upselling:${period}`, (signal) => api<UpsellingData>("/analytics/upselling", { signal, query: { period } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;
  const data = res.data;

  return (
    <>
      <PageHeader title="Upselling" subtitle="Add-on revenue and popular items." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load upselling.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Add-on revenue" value={data.summary.totalAddOnRevenueFormatted} />
              <StatTile label="Add-on orders" value={data.summary.totalAddOnOrders} />
              <StatTile label="Conversion rate" value={data.summary.conversionRate} hint="Orders with add-ons" />
              <StatTile label="Avg add-on value" value={data.summary.averageAddOnValue} />
            </div>

            <Card title="Breakdown by type">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {data.byType.map((t) => (
                  <div key={t.type} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3 text-center">
                    <div className="text-2xl" aria-hidden="true">{t.emoji}</div>
                    <div className="mt-1 text-sm text-oh-stone/70">{t.label}</div>
                    <div className="font-display text-xl tabular-nums text-oh-charcoal">{t.count}</div>
                    <div className="text-sm font-semibold text-oh-olive">{t.revenueFormatted}</div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DataTable title="Most popular add-ons" rows={data.topByPopularity}
                columns={[
                  { key: "name", label: "Item" },
                  { key: "orderCount", label: "Orders", align: "right" },
                  { key: "quantity", label: "Qty", align: "right" },
                  { key: "revenueFormatted", label: "Revenue", align: "right" },
                ]} />
              <DataTable title="Top revenue add-ons" rows={data.topByRevenue}
                columns={[
                  { key: "name", label: "Item" },
                  { key: "orderCount", label: "Orders", align: "right" },
                  { key: "quantity", label: "Qty", align: "right" },
                  { key: "revenueFormatted", label: "Revenue", align: "right" },
                ]} />
            </div>

            {data.summary.totalParentOrders > 0 && (
              <Card title="Upselling insight">
                <p className="text-[15px] leading-relaxed text-oh-stone">
                  {data.summary.ordersWithAddons} out of {data.summary.totalParentOrders} orders ({data.summary.conversionRate}) included at least one add-on.
                  The average add-on value is {data.summary.averageAddOnValue}.
                  {data.summary.totalAddOnOrders > 0 && " Consider promoting your most popular add-on items to increase upselling conversion."}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
