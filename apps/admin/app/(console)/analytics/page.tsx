"use client";
import Link from "next/link";
import { useState } from "react";
import { useRole } from "@/components/providers/RoleProvider";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile, type StatTone } from "@/components/ui/StatTile";
import { Icon } from "@/components/ui/icons";
import { API_BASE, api } from "@/lib/api";
import { reportsFor, type Period, type Report } from "@/lib/analytics";
import { type TodayPayload } from "@/lib/today";
import { useResource } from "@/lib/use-resource";
import { PeriodSelector } from "./components/PeriodSelector";
import { SimpleBarChart, type BarPoint } from "./components/SimpleBarChart";

type OverviewData = {
  metrics: {
    totalRevenue: { value: number; formatted: string; change: string };
    totalOrders: { value: number; change: string };
    averageOrderValue: { value: number; formatted: string; change: string };
    uniqueCustomers: { value: number; change: string };
  };
};

type RealtimeData = {
  today: { orders: number; revenue: number; revenueFormatted: string; completed: number };
  live: { activeOrders: number; queueLength: number };
};

type RevenueData = { timeline: Array<{ date: string; revenue: number; revenueFormatted: string; orders: number }> };

type SourceStats = { orders: number; revenue: number; revenueFormatted: string; aovFormatted: string; orderPercentage: number };
type OrderSourceData = { bySource: Partial<Record<"WEB" | "KIOSK" | "MOBILE" | "STAFF", SourceStats>> };

const SOURCES: { key: "WEB" | "KIOSK" | "MOBILE" | "STAFF"; label: string }[] = [
  { key: "WEB", label: "Web app" },
  { key: "KIOSK", label: "Kiosk" },
  { key: "MOBILE", label: "Mobile app" },
  { key: "STAFF", label: "Staff entry" },
];

function changeHint(change: string): { label: string; tone: StatTone } {
  const n = parseFloat(change);
  if (!Number.isFinite(n) || n === 0) return { label: "No change vs previous period", tone: "neutral" };
  return { label: `${n > 0 ? "+" : ""}${n.toFixed(1)}% vs previous period`, tone: n > 0 ? "good" : "alert" };
}

function chartFromTimeline(timeline: RevenueData["timeline"]): BarPoint[] {
  return timeline.map((t) => ({ label: t.date.split("-").slice(1).join("/"), value: t.revenue / 100, formatted: t.revenueFormatted }));
}

export default function AnalyticsHubPage() {
  const role = useRole();
  const isOwner = role === "owner";
  const [period, setPeriod] = useState<Period>("week");

  const overviewRes = useResource(isOwner ? `hub:overview:${period}` : null, (signal) => api<OverviewData>("/analytics/overview", { signal, query: { period } }));
  const revenueRes = useResource(isOwner ? `hub:revenue:${period}` : null, (signal) => api<RevenueData>("/analytics/revenue", { signal, query: { period, groupBy: "day" } }));
  const sourcesRes = useResource(isOwner ? `hub:sources:${period}` : null, (signal) => api<OrderSourceData>("/analytics/order-sources", { signal, query: { period } }));
  const realtimeRes = useResource(isOwner ? "hub:realtime" : null, (signal) => api<RealtimeData>("/analytics/realtime", { signal }), { refreshMs: 30_000 });
  const todayRes = useResource(!isOwner ? "hub:today" : null, (signal) => api<TodayPayload>("/admin/today", { signal }));

  const reports = reportsFor(role);
  const dev = process.env.NODE_ENV !== "production";

  const failed = isOwner
    ? (overviewRes.error && !overviewRes.data) || (revenueRes.error && !revenueRes.data) || (sourcesRes.error && !sourcesRes.data)
    : todayRes.error && !todayRes.data;
  const loading = isOwner ? !overviewRes.data && !failed : !todayRes.data && !failed;

  function retry() {
    if (isOwner) {
      overviewRes.reload();
      revenueRes.reload();
      sourcesRes.reload();
    } else {
      todayRes.reload();
    }
  }

  return (
    <>
      <PageHeader title="Analytics" subtitle={isOwner ? "Revenue, orders and the reports behind them." : "Today's pulse, and the reports you can open."} />
      <div className="space-y-5 lg:space-y-6">
        {isOwner && <PeriodSelector value={period} onChange={setPeriod} />}
        {failed ? (
          <ErrorCard message={`Couldn't load analytics.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={retry} />
        ) : loading ? (
          <SkeletonList rows={4} />
        ) : isOwner ? (
          <>
            <LiveStrip data={realtimeRes.data} />
            <OverviewTiles data={overviewRes.data} />
            {revenueRes.data && <SimpleBarChart title="Revenue over time" data={chartFromTimeline(revenueRes.data.timeline)} />}
            {sourcesRes.data && <OrderSources data={sourcesRes.data} />}
          </>
        ) : (
          <ManagerPulse data={todayRes.data} />
        )}

        <section className="space-y-2.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">Reports</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => <ReportCard key={r.href} report={r} />)}
          </div>
        </section>
      </div>
    </>
  );
}

function LiveStrip({ data }: { data: RealtimeData | null }) {
  return (
    <section className="rounded-card border border-oh-stone/15 bg-oh-charcoal p-4 text-oh-cream shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-oh-olive-light motion-safe:animate-pulse" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-cream/80">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <div className="text-xs text-oh-cream/60">Today&apos;s revenue</div>
          <div className="font-display text-2xl tabular-nums">{data?.today.revenueFormatted ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-oh-cream/60">Orders today</div>
          <div className="font-display text-2xl tabular-nums">{data?.today.orders ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-oh-cream/60">Active orders</div>
          <div className="font-display text-2xl tabular-nums">{data?.live.activeOrders ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-oh-cream/60">Queue length</div>
          <div className="font-display text-2xl tabular-nums">{data?.live.queueLength ?? "-"}</div>
        </div>
      </div>
    </section>
  );
}

function OverviewTiles({ data }: { data: OverviewData | null }) {
  if (!data) return null;
  const { totalRevenue, totalOrders, averageOrderValue, uniqueCustomers } = data.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Total revenue" value={totalRevenue.formatted} hint={changeHint(totalRevenue.change).label} tone={changeHint(totalRevenue.change).tone} />
      <StatTile label="Total orders" value={totalOrders.value} hint={changeHint(totalOrders.change).label} tone={changeHint(totalOrders.change).tone} />
      <StatTile label="Average order" value={averageOrderValue.formatted} hint={changeHint(averageOrderValue.change).label} tone={changeHint(averageOrderValue.change).tone} />
      <StatTile label="Unique customers" value={uniqueCustomers.value} hint={changeHint(uniqueCustomers.change).label} tone={changeHint(uniqueCustomers.change).tone} />
    </div>
  );
}

function OrderSources({ data }: { data: OrderSourceData }) {
  return (
    <Card title="Orders by source">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SOURCES.map((s) => {
          const stats = data.bySource[s.key];
          const comingSoon = s.key === "MOBILE" && (!stats || stats.orders === 0);
          return (
            <div key={s.key} className={`rounded-xl border border-oh-stone/15 bg-oh-paper p-3 ${comingSoon ? "opacity-60" : ""}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">{s.label}</div>
              <div className="mt-1.5 font-display text-2xl tabular-nums text-oh-charcoal">{stats?.orders ?? 0}</div>
              <div className="text-sm text-oh-stone/70">{comingSoon ? "Coming soon" : `${stats?.orderPercentage ?? 0}% of orders`}</div>
              {!comingSoon && <div className="mt-1 text-xs tabular-nums text-oh-stone/60">{stats?.revenueFormatted ?? "$0.00"} &middot; avg {stats?.aovFormatted ?? "$0.00"}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ManagerPulse({ data }: { data: TodayPayload | null }) {
  if (!data) return <SkeletonList rows={1} />;
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="Orders today" value={data.ordersToday} />
      <StatTile label="In the dining room" value={data.activeDiners} />
      <StatTile label="Pod calls" value={data.openPodCalls} tone={data.openPodCalls > 0 ? "alert" : "neutral"} href="/kitchen" />
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <Link href={report.href}
      className="flex items-start gap-3 rounded-card border border-oh-stone/15 bg-oh-cream p-4 shadow-card transition-colors hover:border-oh-stone/30 hover:bg-oh-linen/50">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oh-linen text-oh-ember-deep" aria-hidden="true">
        <Icon name={report.icon} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[1.25rem] leading-tight text-oh-charcoal">{report.title}</span>
        <span className="mt-1 block text-sm text-oh-stone/70">{report.blurb}</span>
      </span>
    </Link>
  );
}
