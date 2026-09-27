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
import { PeriodSelector } from "../components/PeriodSelector";
import { SimpleBarChart, type BarPoint } from "../components/SimpleBarChart";

type Metric = { value: string; unit: string; sampleSize: number };
type OperationsData = {
  metrics: { averagePrepTime: Metric; averageWaitTime: Metric; averageTurnaroundTime: Metric; onTimeArrivalRate: Metric };
  statusBreakdown: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
  hourlyDistribution: Record<string, number>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending", PAID: "Paid", QUEUED: "Queued", PREPPING: "Prepping",
  READY: "Ready", SERVING: "Serving", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export default function OperationsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const res = useResource(`operations:${period}`, (signal) => api<OperationsData>("/analytics/operations", { signal, query: { period } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;

  const hourlyChart: BarPoint[] = res.data
    ? Object.entries(res.data.hourlyDistribution).map(([hour, count]) => ({ label: `${hour}:00`, value: count, formatted: `${count} orders` }))
    : [];
  const statusData = res.data
    ? Object.entries(res.data.statusBreakdown).filter(([, count]) => count > 0).map(([status, count]) => ({ status: STATUS_LABELS[status] ?? status, count }))
    : [];

  return (
    <>
      <PageHeader title="Operations" subtitle="Kitchen efficiency, wait times and peak hours." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load operations.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !res.data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Avg prep time" value={`${res.data.metrics.averagePrepTime.value} min`} hint={`${res.data.metrics.averagePrepTime.sampleSize} orders`} />
              <StatTile label="Avg wait time" value={`${res.data.metrics.averageWaitTime.value} min`} hint={`${res.data.metrics.averageWaitTime.sampleSize} orders`} />
              <StatTile label="Avg turnaround" value={`${res.data.metrics.averageTurnaroundTime.value} min`} hint={`${res.data.metrics.averageTurnaroundTime.sampleSize} orders`} />
              <StatTile label="On-time arrivals" value={`${res.data.metrics.onTimeArrivalRate.value}%`} hint={`${res.data.metrics.onTimeArrivalRate.sampleSize} check-ins`} />
            </div>

            {res.data.peakHours.length > 0 && (
              <Card title="Peak hours">
                <div className="flex flex-wrap gap-2">
                  {res.data.peakHours.map((p, i) => (
                    <div key={p.hour} className={`rounded-xl border px-4 py-2.5 ${i === 0 ? "border-oh-gold bg-oh-gold/10" : "border-oh-stone/15 bg-oh-paper"}`}>
                      <div className="font-display text-lg tabular-nums text-oh-charcoal">{String(p.hour).padStart(2, "0")}:00</div>
                      <div className="text-sm text-oh-stone/70">{p.count} orders</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <SimpleBarChart title="Orders by hour of day" data={hourlyChart} />

            {statusData.length > 0 && (
              <Card title="Order status">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {statusData.map((s) => (
                    <div key={s.status} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3">
                      <div className="font-display text-2xl tabular-nums text-oh-charcoal">{s.count}</div>
                      <div className="text-sm text-oh-stone/70">{s.status}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
