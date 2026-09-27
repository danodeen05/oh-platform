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

type Tier = "CHOPSTICK" | "NOODLE_MASTER" | "BEEF_BOSS";
type CustomerData = {
  summary: { totalCustomers: number; newCustomers: number; returningCustomers: number; repeatCustomers: number; repeatRate: string; averageLifetimeValue: string };
  tierDistribution: Record<Tier, number>;
  topCustomers: Array<{ id: string; name: string; email: string | null; orderCount: number; periodSpendFormatted: string; lifetimeSpendFormatted: string; tier: Tier }>;
};

const TIER_LABEL: Record<Tier, string> = { CHOPSTICK: "Chopstick", NOODLE_MASTER: "Noodle Master", BEEF_BOSS: "Beef Boss" };
const TIERS: Tier[] = ["CHOPSTICK", "NOODLE_MASTER", "BEEF_BOSS"];

export default function CustomersPage() {
  const [period, setPeriod] = useState<Period>("month");
  const res = useResource(`customers:${period}`, (signal) => api<CustomerData>("/analytics/customers", { signal, query: { period } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;

  const rows = res.data?.topCustomers.map((c, i) => ({ ...c, rank: i + 1 })) ?? [];
  const total = res.data?.summary.totalCustomers || 1;
  const newC = res.data?.summary.newCustomers ?? 0;
  const retC = res.data?.summary.returningCustomers ?? 0;

  return (
    <>
      <PageHeader title="Customers" subtitle="Loyalty tiers and lifetime value." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load customer insights.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !res.data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Total customers" value={res.data.summary.totalCustomers} />
              <StatTile label="New" value={res.data.summary.newCustomers} hint="This period" />
              <StatTile label="Returning" value={res.data.summary.returningCustomers} />
              <StatTile label="Repeat rate" value={`${res.data.summary.repeatRate}%`} hint="Ordered 2+ times" />
              <StatTile label="Avg lifetime value" value={res.data.summary.averageLifetimeValue} />
            </div>

            <Card title="Loyalty tier distribution">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TIERS.map((tier) => {
                  const count = res.data!.tierDistribution[tier] ?? 0;
                  const pct = ((count / total) * 100).toFixed(1);
                  return (
                    <div key={tier} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3">
                      <div className="text-sm text-oh-stone/70">{TIER_LABEL[tier]}</div>
                      <div className="font-display text-2xl tabular-nums text-oh-charcoal">{count}</div>
                      <div className="text-sm text-oh-stone/60">{pct}% of customers</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-oh-stone/15">
                        <div
                          style={{ width: `${pct}%` }} // style-ok: share of customers
                          className="h-full rounded-full bg-oh-clay" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Customer composition">
              <div className="flex h-8 overflow-hidden rounded-full bg-oh-linen">
                {newC > 0 && (
                  <div style={{ flexGrow: newC }} className="flex items-center justify-center whitespace-nowrap bg-oh-olive px-2 text-xs font-semibold text-oh-cream"> {/* style-ok: proportion of new customers */}
                    New ({newC})
                  </div>
                )}
                {retC > 0 && (
                  <div style={{ flexGrow: retC }} className="flex items-center justify-center whitespace-nowrap bg-oh-ember-deep px-2 text-xs font-semibold text-oh-cream"> {/* style-ok: proportion of returning customers */}
                    Returning ({retC})
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-sm text-oh-stone/70">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-oh-olive" aria-hidden="true" />New customers</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-oh-ember-deep" aria-hidden="true" />Returning customers</span>
              </div>
            </Card>

            <DataTable title="Top customers (by period spend)" rows={rows}
              columns={[
                { key: "rank", label: "#", render: (c) => `#${c.rank}` },
                { key: "name", label: "Name" },
                { key: "email", label: "Email", render: (c) => (c.email ? <a className="text-oh-ember-deep hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : null) },
                { key: "tier", label: "Tier", render: (c) => TIER_LABEL[c.tier] },
                { key: "orderCount", label: "Orders", align: "right" },
                { key: "periodSpendFormatted", label: "Period spend", align: "right" },
                { key: "lifetimeSpendFormatted", label: "Lifetime spend", align: "right" },
              ]} />
          </>
        )}
      </div>
    </>
  );
}
