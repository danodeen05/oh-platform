"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { PeriodSelector } from "../components/PeriodSelector";

type FunnelStep = { name: string; event: string; count: number; users: number; conversionRate: string; dropOff: string };
type FunnelData = { steps: FunnelStep[]; overallConversionRate: string; totalVisitors: number; totalPurchases: number };

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Failed to fetch funnel data");

export default function FunnelPage() {
  const [period, setPeriod] = useState<Period>("week");
  const res = useResource(`funnel:${period}`, (signal) => api<FunnelData>("/analytics/ga4/funnel", { signal, query: { period } }));
  const failed = res.error && !res.data;
  const data = res.data;
  const maxUsers = Math.max(...(data?.steps.map((s) => s.users) ?? [1]), 1);

  return (
    <>
      <PageHeader title="Funnel" subtitle="Order conversion, step by step." back={{ href: "/analytics", label: "Analytics" }}
        actions={<LinkButton href="/analytics/traffic" icon="chart">Traffic</LinkButton>} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`GA4 not configured. ${errorText(res.error)}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Total visitors" value={data.totalVisitors.toLocaleString()} hint="Page views" />
              <StatTile label="Total purchases" value={data.totalPurchases.toLocaleString()} hint="Completed orders" />
              <StatTile label="Conversion rate" value={data.overallConversionRate} hint="Visitor to purchase" />
            </div>

            <Card title="Funnel steps">
              <div className="space-y-4">
                {data.steps.map((step, i) => {
                  const isLast = i === data.steps.length - 1;
                  const widthPct = Math.max(4, (step.users / maxUsers) * 100);
                  const dropOff = parseFloat(step.dropOff);
                  return (
                    <div key={step.event} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-semibold text-oh-charcoal">{step.name}</span>
                        <span className="text-sm tabular-nums text-oh-stone/70">
                          {step.users.toLocaleString()} &middot; {step.conversionRate}% conversion
                          {i > 0 && dropOff > 0 ? ` · -${step.dropOff}% drop-off` : ""}
                        </span>
                      </div>
                      <div className="h-8 overflow-hidden rounded-lg bg-oh-linen">
                        <div
                          style={{ width: `${widthPct}%` }} // style-ok: bar width from step users
                          className={`h-full rounded-lg ${isLast ? "bg-oh-olive" : "bg-oh-ember-deep"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oh-gold/20 text-oh-clay" aria-hidden="true">
                  <Icon name="sparkle" size={18} />
                </span>
                <div className="space-y-2 text-[15px] leading-relaxed text-oh-stone">
                  <p className="font-semibold text-oh-charcoal">Insights</p>
                  {data.steps.map((step, i) => {
                    if (i === 0) return null;
                    const dropOff = parseFloat(step.dropOff);
                    if (dropOff > 50) return <p key={step.event}><strong className="text-oh-charcoal">{dropOff}%</strong> of users drop off at &quot;{step.name}&quot;. Consider optimizing this step.</p>;
                    return null;
                  })}
                  {parseFloat(data.overallConversionRate) < 1 ? (
                    <p>Your overall conversion rate is <strong className="text-oh-charcoal">{data.overallConversionRate}</strong>. Focus on reducing friction in steps with high drop-off.</p>
                  ) : (
                    <p>Your conversion rate of <strong className="text-oh-charcoal">{data.overallConversionRate}</strong> is healthy. Keep monitoring for opportunities to improve.</p>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
