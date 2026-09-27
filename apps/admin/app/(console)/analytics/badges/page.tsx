"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { API_BASE, api } from "@/lib/api";
import { denverDateTime } from "@/lib/format";
import type { Period } from "@/lib/analytics";
import { useResource } from "@/lib/use-resource";
import { DataTable } from "../components/DataTable";
import { PeriodSelector } from "../components/PeriodSelector";

type BadgeRow = { id: string; name: string; description: string; iconEmoji: string; category: string; isActive: boolean; totalEarned: number; earnedThisPeriod: number; uniqueHolders: number; rarity: string };
type BadgesData = {
  summary: { totalBadges: number; activeBadges: number; totalAwarded: number; awardedThisPeriod: number; uniqueBadgeHolders: number; averageBadgesPerUser: string };
  byCategory: Record<string, { count: number; totalEarned: number }>;
  badges: BadgeRow[];
  recentAwards: Array<{ id: string; badgeName: string; badgeEmoji: string; userName: string; earnedAt: string }>;
};

export default function BadgesPage() {
  const [period, setPeriod] = useState<Period>("month");
  const res = useResource(`badges:${period}`, (signal) => api<BadgesData>("/analytics/badges", { signal, query: { period } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;
  const data = res.data;

  return (
    <>
      <PageHeader title="Badges" subtitle="Distribution, engagement and recent awards." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load badges.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Active badges" value={data.summary.activeBadges} hint={`of ${data.summary.totalBadges} total`} />
              <StatTile label="Awarded this period" value={data.summary.awardedThisPeriod} />
              <StatTile label="Total awarded" value={data.summary.totalAwarded} hint="All time" />
              <StatTile label="Badge holders" value={data.summary.uniqueBadgeHolders} />
              <StatTile label="Avg per user" value={data.summary.averageBadgesPerUser} />
            </div>

            {Object.keys(data.byCategory).length > 0 && (
              <Card title="Badges by category">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(data.byCategory).map(([category, stats]) => (
                    <div key={category} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3">
                      <div className="text-sm text-oh-stone/70">{category}</div>
                      <div className="font-display text-2xl tabular-nums text-oh-charcoal">{stats.count}</div>
                      <div className="text-sm text-oh-stone/60">{stats.totalEarned} earned</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data.badges.length > 0 && (
              <Card title="Badge gallery">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {data.badges.map((b) => (
                    <div key={b.id} title={b.description} className={`rounded-xl border border-oh-stone/15 bg-oh-paper p-3 text-center ${b.isActive ? "" : "opacity-60"}`}>
                      <div className="text-3xl" aria-hidden="true">{b.iconEmoji}</div>
                      <div className="mt-1.5 truncate text-xs font-semibold text-oh-charcoal">{b.name}</div>
                      <div className="text-[11px] text-oh-stone/60">{b.rarity}</div>
                      <div className="mt-1.5 font-display text-lg tabular-nums text-oh-charcoal">{b.totalEarned}</div>
                      <div className="text-[11px] text-oh-stone/50">earned</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              <DataTable title="All badges" rows={data.badges}
                columns={[
                  { key: "name", label: "Badge" },
                  { key: "category", label: "Category" },
                  { key: "rarity", label: "Rarity" },
                  { key: "totalEarned", label: "Total earned", align: "right" },
                  { key: "earnedThisPeriod", label: "This period", align: "right" },
                  { key: "uniqueHolders", label: "Holders", align: "right" },
                ]} />

              {data.recentAwards.length > 0 && (
                <Card title="Recent awards">
                  <div className="space-y-2">
                    {data.recentAwards.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-oh-paper p-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span aria-hidden="true">{a.badgeEmoji}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-oh-charcoal">{a.badgeName}</div>
                            <div className="truncate text-xs text-oh-stone/60">{a.userName}</div>
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-oh-stone/60">{denverDateTime(a.earnedAt)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
