"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { api, ApiError } from "@/lib/api";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";
import { PeriodSelector } from "../components/PeriodSelector";
import { SimpleBarChart, type BarPoint } from "../components/SimpleBarChart";

type TrafficData = { summary: { activeUsers: number; sessions: number; pageViews: number; newUsers: number; bounceRate: string; avgSessionDuration: string }; timeline: Array<{ date: string; pageViews: number }> };
type PagesData = { pages: Array<{ path: string; views: number; users: number; bounceRate: string }> };
type SourcesData = { sources: Array<{ source: string; medium: string; sessions: number; users: number }> };
type DevicesData = { devices: Array<{ device: string; users: number; percentage: string }> };
type GeoData = { locations: Array<{ city: string; country: string; users: number }> };
type HourlyData = { hourly: Array<{ hour: number; hourLabel: string; users: number }>; peakHour: string };
type RealtimeData = { activeUsers: number; topPages: Array<{ page: string; users: number }> };

type Combined = { traffic: TrafficData; pages: PagesData; sources: SourcesData; devices: DevicesData; geo: GeoData; hourly: HourlyData };

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Failed to fetch GA4 analytics");

export default function TrafficPage() {
  const [period, setPeriod] = useState<Period>("week");
  const res = useResource(`traffic:${period}`, async (signal) => {
    const [traffic, pages, sources, devices, geo, hourly] = await Promise.all([
      api<TrafficData>("/analytics/ga4/traffic", { signal, query: { period } }),
      api<PagesData>("/analytics/ga4/pages", { signal, query: { period, limit: 10 } }),
      api<SourcesData>("/analytics/ga4/sources", { signal, query: { period } }),
      api<DevicesData>("/analytics/ga4/devices", { signal, query: { period } }),
      api<GeoData>("/analytics/ga4/geo", { signal, query: { period } }),
      api<HourlyData>("/analytics/ga4/hourly", { signal, query: { period } }),
    ]);
    return { traffic, pages, sources, devices, geo, hourly } as Combined;
  });
  const realtimeRes = useResource("traffic:realtime", (signal) => api<RealtimeData>("/analytics/ga4/realtime", { signal }), { refreshMs: 30_000 });

  const failed = res.error && !res.data;
  const data = res.data;

  const pageViewsChart: BarPoint[] = data?.traffic.timeline.map((t) => ({ label: t.date.slice(5).replace("-", "/"), value: t.pageViews, formatted: `${t.pageViews} views` })) ?? [];
  const hourlyChart: BarPoint[] = data?.hourly.hourly.map((h) => ({ label: h.hourLabel, value: h.users, formatted: `${h.users} users` })) ?? [];

  return (
    <>
      <PageHeader title="Traffic" subtitle="Powered by Google Analytics 4." back={{ href: "/analytics", label: "Analytics" }}
        actions={<LinkButton href="/analytics/funnel" icon="filter">Funnel</LinkButton>} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`GA4 not configured. ${errorText(res.error)}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            {realtimeRes.data && (
              <section className="rounded-card border border-oh-stone/15 bg-oh-charcoal p-4 text-oh-cream shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-oh-olive-light motion-safe:animate-pulse" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-cream/80">Live on site</span>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-oh-cream/60">Active users now</div>
                  <div className="font-display text-2xl tabular-nums">{realtimeRes.data.activeUsers}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {realtimeRes.data.topPages.slice(0, 5).map((p, i) => (
                    <span key={i} className="rounded-full bg-oh-cream/15 px-3 py-1 text-xs">{p.page} ({p.users})</span>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <StatTile label="Active users" value={data.traffic.summary.activeUsers.toLocaleString()} />
              <StatTile label="Sessions" value={data.traffic.summary.sessions.toLocaleString()} />
              <StatTile label="Page views" value={data.traffic.summary.pageViews.toLocaleString()} />
              <StatTile label="New users" value={data.traffic.summary.newUsers.toLocaleString()} />
              <StatTile label="Bounce rate" value={data.traffic.summary.bounceRate} tone="alert" />
              <StatTile label="Avg session" value={data.traffic.summary.avgSessionDuration} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SimpleBarChart title="Page views over time" data={pageViewsChart} />
              <SimpleBarChart title={`Activity by hour (peak ${data.hourly.peakHour})`} data={hourlyChart} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DataTable title="Top pages" rows={data.pages.pages}
                columns={[
                  { key: "path", label: "Page", render: (p) => (p.path.length > 30 ? `${p.path.slice(0, 30)}...` : p.path) },
                  { key: "views", label: "Views", align: "right", render: (p) => p.views.toLocaleString() },
                  { key: "users", label: "Users", align: "right", render: (p) => p.users.toLocaleString() },
                  { key: "bounceRate", label: "Bounce", align: "right", render: (p) => `${p.bounceRate}%` },
                ]} />
              <DataTable title="Traffic sources" rows={data.sources.sources.slice(0, 10)}
                columns={[
                  { key: "source", label: "Source" },
                  { key: "medium", label: "Medium" },
                  { key: "sessions", label: "Sessions", align: "right", render: (s) => s.sessions.toLocaleString() },
                  { key: "users", label: "Users", align: "right", render: (s) => s.users.toLocaleString() },
                ]} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Device breakdown">
                <div className="space-y-3">
                  {data.devices.devices.map((d, i) => (
                    <div key={i}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium capitalize text-oh-charcoal">{d.device}</span>
                        <span className="tabular-nums text-oh-stone/70">{d.users.toLocaleString()} ({d.percentage}%)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-oh-linen">
                        <div
                          style={{ width: `${d.percentage}%` }} // style-ok: device share of users
                          className="h-full rounded-full bg-oh-ember-deep" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <DataTable title="Top locations" rows={data.geo.locations.slice(0, 10)}
                columns={[
                  { key: "city", label: "City" },
                  { key: "country", label: "Country" },
                  { key: "users", label: "Users", align: "right", render: (l) => l.users.toLocaleString() },
                ]} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
