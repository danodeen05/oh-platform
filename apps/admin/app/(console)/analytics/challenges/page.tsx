"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
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

type ChallengeRow = {
  id: string; name: string; description: string; iconEmoji: string; rewardFormatted: string; isActive: boolean;
  enrollments: number; completions: number; completionRate: string; totalRewardsIssuedFormatted: string;
};
type ChallengesData = {
  summary: { totalChallenges: number; activeChallenges: number; totalEnrollments: number; totalCompletions: number; overallCompletionRate: string; totalRewardsIssuedFormatted: string };
  challenges: ChallengeRow[];
};

export default function ChallengesPage() {
  const [period, setPeriod] = useState<Period>("month");
  const res = useResource(`challenges:${period}`, (signal) => api<ChallengesData>("/analytics/challenges", { signal, query: { period } }));
  const dev = process.env.NODE_ENV !== "production";
  const failed = res.error && !res.data;
  const data = res.data;

  return (
    <>
      <PageHeader title="Challenges" subtitle="Engagement, completion and rewards." back={{ href: "/analytics", label: "Analytics" }} />
      <div className="space-y-5 lg:space-y-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {failed ? (
          <ErrorCard message={`Couldn't load challenges.${dev ? ` API: ${API_BASE || "not set"}` : ""}`} onRetry={res.reload} />
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Active challenges" value={data.summary.activeChallenges} hint={`of ${data.summary.totalChallenges} total`} />
              <StatTile label="Enrollments" value={data.summary.totalEnrollments} />
              <StatTile label="Completions" value={data.summary.totalCompletions} />
              <StatTile label="Completion rate" value={`${data.summary.overallCompletionRate}%`} />
              <StatTile label="Rewards issued" value={data.summary.totalRewardsIssuedFormatted} hint="In credits" />
            </div>

            {data.challenges.length > 0 && (
              <Card title="Challenge performance">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.challenges.map((c) => (
                    <div key={c.id} className="rounded-xl border border-oh-stone/15 bg-oh-paper p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl" aria-hidden="true">{c.iconEmoji}</span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-oh-charcoal">{c.name}</div>
                          <div className="text-xs text-oh-stone/70">Reward: {c.rewardFormatted}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div><div className="text-lg font-semibold tabular-nums text-oh-charcoal">{c.enrollments}</div><div className="text-[11px] text-oh-stone/60">Enrolled</div></div>
                        <div><div className="text-lg font-semibold tabular-nums text-oh-charcoal">{c.completions}</div><div className="text-[11px] text-oh-stone/60">Completed</div></div>
                        <div><div className="text-lg font-semibold tabular-nums text-oh-charcoal">{c.completionRate}%</div><div className="text-[11px] text-oh-stone/60">Rate</div></div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-oh-stone/15">
                        <div
                          style={{ width: `${Math.min(100, parseFloat(c.completionRate))}%` }} // style-ok: completion rate share
                          className={`h-full rounded-full ${c.isActive ? "bg-oh-olive" : "bg-oh-stone/40"}`} />
                      </div>
                      <div className="mt-2 text-right text-xs text-oh-stone/60">{c.totalRewardsIssuedFormatted} in rewards</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <DataTable title="All challenges" rows={data.challenges}
              columns={[
                { key: "name", label: "Challenge", render: (c) => c.name },
                { key: "isActive", label: "Status", render: (c) => <Badge tone={c.isActive ? "good" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge> },
                { key: "rewardFormatted", label: "Reward", align: "right" },
                { key: "enrollments", label: "Enrollments", align: "right" },
                { key: "completions", label: "Completions", align: "right" },
                { key: "completionRate", label: "Completion rate", align: "right", render: (c) => `${c.completionRate}%` },
                { key: "totalRewardsIssuedFormatted", label: "Rewards issued", align: "right" },
              ]} />
          </>
        )}
      </div>
    </>
  );
}
