"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type BadgeData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconEmoji: string;
  category: string;
  isActive: boolean;
  totalEarned: number;
  earnedThisPeriod: number;
  uniqueHolders: number;
  rarity: string;
};

type BadgesAnalytics = {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalBadges: number;
    activeBadges: number;
    totalAwarded: number;
    awardedThisPeriod: number;
    uniqueBadgeHolders: number;
    averageBadgesPerUser: string;
  };
  byCategory: {
    [category: string]: {
      count: number;
      totalEarned: number;
    };
  };
  badges: BadgeData[];
  recentAwards: Array<{
    id: string;
    badgeName: string;
    badgeEmoji: string;
    userName: string;
    earnedAt: string;
  }>;
};

export default function BadgesAnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<BadgesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BASE}/analytics/badges?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load badges data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading badges analytics...
      </div>
    );
  }

  const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
    ORDERS: { bg: "#f0f9ff", border: "#3b82f6", text: "#1e40af" },
    STREAK: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    SOCIAL: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
    EXPLORATION: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    SPECIAL: { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce" },
  };

  const rarityColors: Record<string, string> = {
    Common: "#6b7280",
    Uncommon: "#22c55e",
    Rare: "#3b82f6",
    Epic: "#a855f7",
    Legendary: "#f59e0b",
  };

  const badgesTableData = data?.badges?.map((b) => ({
    badge: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "1.5rem" }}>{b.iconEmoji}</span>
        <div>
          <div style={{ fontWeight: 600 }}>{b.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{b.description}</div>
        </div>
      </div>
    ),
    category: (
      <span style={{
        padding: "4px 8px",
        background: categoryColors[b.category]?.bg || "#f3f4f6",
        color: categoryColors[b.category]?.text || "#374151",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 600
      }}>
        {b.category}
      </span>
    ),
    rarity: (
      <span style={{ color: rarityColors[b.rarity] || "#6b7280", fontWeight: 600 }}>
        {b.rarity}
      </span>
    ),
    totalEarned: b.totalEarned,
    earnedThisPeriod: b.earnedThisPeriod,
    uniqueHolders: b.uniqueHolders,
  })) || [];

  const recentAwardsData = data?.recentAwards?.map((a) => ({
    badge: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "1.25rem" }}>{a.badgeEmoji}</span>
        <span style={{ fontWeight: 500 }}>{a.badgeName}</span>
      </div>
    ),
    user: a.userName,
    earnedAt: new Date(a.earnedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
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
              <span style={{ color: "#374151", fontWeight: 500 }}>Badges</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Badges Analytics
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track badge distribution, engagement, and gamification effectiveness
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
            title="Active Badges"
            value={data.summary.activeBadges}
            subtitle={`of ${data.summary.totalBadges} total`}
            color="blue"
          />
          <StatCard
            title="Badges Awarded"
            value={data.summary.awardedThisPeriod}
            subtitle="this period"
            color="green"
          />
          <StatCard
            title="Total Awarded"
            value={data.summary.totalAwarded}
            subtitle="all time"
            color="yellow"
          />
          <StatCard
            title="Badge Holders"
            value={data.summary.uniqueBadgeHolders}
            subtitle="unique users"
            color="default"
          />
          <StatCard
            title="Avg per User"
            value={data.summary.averageBadgesPerUser}
            subtitle="badges earned"
            color="default"
          />
        </div>
      )}

      {/* Category Distribution */}
      {data && data.byCategory && Object.keys(data.byCategory).length > 0 && (
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
            Badges by Category
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            {Object.entries(data.byCategory).map(([category, stats]) => {
              const colors = categoryColors[category] || { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" };
              return (
                <div
                  key={category}
                  style={{
                    padding: "20px",
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "8px" }}>
                    {category}
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: colors.text }}>
                    {stats.count}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                    {stats.totalEarned} earned
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badge Gallery */}
      {data && data.badges.length > 0 && (
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
            Badge Gallery
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "16px" }}>
            {data.badges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  padding: "16px",
                  background: badge.isActive ? "#f9fafb" : "#f3f4f6",
                  borderRadius: "12px",
                  textAlign: "center",
                  opacity: badge.isActive ? 1 : 0.6,
                  border: `2px solid ${categoryColors[badge.category]?.border || "#e5e7eb"}`,
                }}
                title={badge.description}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>{badge.iconEmoji}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  {badge.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: rarityColors[badge.rarity] || "#6b7280", fontWeight: 500 }}>
                  {badge.rarity}
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#374151", marginTop: "8px" }}>
                  {badge.totalEarned}
                </div>
                <div style={{ fontSize: "0.65rem", color: "#9ca3af" }}>earned</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Badges Table */}
        <DataTable
          title="All Badges"
          columns={[
            { key: "badge", label: "Badge" },
            { key: "category", label: "Category" },
            { key: "rarity", label: "Rarity" },
            { key: "totalEarned", label: "Total Earned", align: "right" },
            { key: "earnedThisPeriod", label: "This Period", align: "right" },
            { key: "uniqueHolders", label: "Holders", align: "right" },
          ]}
          data={badgesTableData}
        />

        {/* Recent Awards */}
        {recentAwardsData.length > 0 && (
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "20px", color: "#374151" }}>
              Recent Awards
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentAwardsData.slice(0, 10).map((award, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    {award.badge}
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px" }}>
                      {award.user}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {award.earnedAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
