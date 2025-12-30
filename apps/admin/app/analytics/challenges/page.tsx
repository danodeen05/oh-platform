"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type ChallengeData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconEmoji: string;
  rewardCents: number;
  rewardFormatted: string;
  isActive: boolean;
  enrollments: number;
  completions: number;
  rewardsClaimed: number;
  completionRate: string;
  totalRewardsIssued: number;
  totalRewardsIssuedFormatted: string;
};

type ChallengesAnalytics = {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalChallenges: number;
    activeChallenges: number;
    totalEnrollments: number;
    totalCompletions: number;
    totalRewardsIssued: number;
    totalRewardsIssuedFormatted: string;
    overallCompletionRate: string;
  };
  challenges: ChallengeData[];
};

export default function ChallengesAnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<ChallengesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BASE}/analytics/challenges?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load challenges data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading challenges analytics...
      </div>
    );
  }

  const challengesTableData = data?.challenges?.map((c) => ({
    challenge: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "1.5rem" }}>{c.iconEmoji}</span>
        <div>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{c.description}</div>
        </div>
      </div>
    ),
    status: c.isActive ? (
      <span style={{
        padding: "4px 8px",
        background: "#dcfce7",
        color: "#166534",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 600
      }}>
        Active
      </span>
    ) : (
      <span style={{
        padding: "4px 8px",
        background: "#f3f4f6",
        color: "#6b7280",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 600
      }}>
        Inactive
      </span>
    ),
    reward: c.rewardFormatted,
    enrollments: c.enrollments,
    completions: c.completions,
    completionRate: c.completionRate,
    rewardsIssued: c.totalRewardsIssuedFormatted,
  })) || [];

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Link href="/analytics" style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.875rem" }}>
                Analytics
              </Link>
              <span style={{ color: "#d1d5db" }}>/</span>
              <span style={{ color: "#374151", fontWeight: 500 }}>Challenges</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Challenges Analytics
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track challenge engagement, completion rates, and reward distribution
            </p>
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Active Challenges"
            value={data.summary.activeChallenges}
            subtitle={`of ${data.summary.totalChallenges} total`}
            color="blue"
          />
          <StatCard
            title="Enrollments"
            value={data.summary.totalEnrollments}
            subtitle="users enrolled"
            color="green"
          />
          <StatCard
            title="Completions"
            value={data.summary.totalCompletions}
            subtitle="challenges completed"
            color="yellow"
          />
          <StatCard
            title="Completion Rate"
            value={`${data.summary.overallCompletionRate}%`}
            subtitle="of enrollments"
            color="default"
          />
          <StatCard
            title="Rewards Issued"
            value={data.summary.totalRewardsIssuedFormatted}
            subtitle="in credits"
            color="green"
          />
        </div>
      )}

      {/* Challenge Performance Overview */}
      {data && data.challenges.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "20px", color: "#374151" }}>
            Challenge Performance
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {data.challenges.map((challenge) => (
              <div
                key={challenge.id}
                style={{
                  padding: "20px",
                  background: challenge.isActive ? "#f0fdf4" : "#f9fafb",
                  border: `2px solid ${challenge.isActive ? "#22c55e" : "#e5e7eb"}`,
                  borderRadius: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "2rem" }}>{challenge.iconEmoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#374151" }}>{challenge.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Reward: {challenge.rewardFormatted}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#3b82f6" }}>
                      {challenge.enrollments}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Enrolled</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22c55e" }}>
                      {challenge.completions}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Completed</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b" }}>
                      {challenge.completionRate}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Rate</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "8px",
                    background: "#e5e7eb",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: challenge.completionRate,
                      height: "100%",
                      background: challenge.isActive ? "#22c55e" : "#9ca3af",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#6b7280", textAlign: "right" }}>
                  {challenge.totalRewardsIssuedFormatted} in rewards issued
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenges Table */}
      <DataTable
        title="All Challenges"
        columns={[
          { key: "challenge", label: "Challenge" },
          { key: "status", label: "Status" },
          { key: "reward", label: "Reward", align: "right" },
          { key: "enrollments", label: "Enrollments", align: "right" },
          { key: "completions", label: "Completions", align: "right" },
          { key: "completionRate", label: "Completion Rate", align: "right" },
          { key: "rewardsIssued", label: "Rewards Issued", align: "right" },
        ]}
        data={challengesTableData}
      />
    </div>
  );
}
