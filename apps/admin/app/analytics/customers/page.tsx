"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type CustomerData = {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatCustomers: number;
    repeatRate: string;
    averageLifetimeValue: string;
  };
  tierDistribution: {
    CHOPSTICK: number;
    NOODLE_MASTER: number;
    BEEF_BOSS: number;
  };
  topCustomers: Array<{
    id: string;
    orderCount: number;
    periodSpend: number;
    periodSpendFormatted: string;
    lifetimeSpend: number;
    lifetimeSpendFormatted: string;
    tier: string;
  }>;
};

export default function CustomersPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BASE}/analytics/customers?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load customer data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading customer analytics...
      </div>
    );
  }

  const tierIcons: Record<string, string> = {
    CHOPSTICK: "Chopstick",
    NOODLE_MASTER: "Noodle Master",
    BEEF_BOSS: "Beef Boss",
  };

  const tierColors: Record<string, { bg: string; border: string; text: string }> = {
    CHOPSTICK: { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
    NOODLE_MASTER: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    BEEF_BOSS: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  };

  const topCustomersTableData = data?.topCustomers?.map((c, i) => ({
    rank: `#${i + 1}`,
    tier: tierIcons[c.tier] || c.tier,
    orders: c.orderCount,
    periodSpend: c.periodSpendFormatted,
    lifetimeSpend: c.lifetimeSpendFormatted,
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
              <span style={{ color: "#374151", fontWeight: 500 }}>Customers</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Customer Insights
            </h1>
            <p style={{ color: "#6b7280" }}>
              Understand your customer base, loyalty trends, and lifetime value
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
            title="Total Customers"
            value={data.summary.totalCustomers}
            color="blue"
          />
          <StatCard
            title="New Customers"
            value={data.summary.newCustomers}
            subtitle="in this period"
            color="green"
          />
          <StatCard
            title="Returning"
            value={data.summary.returningCustomers}
            subtitle="existing customers"
            color="default"
          />
          <StatCard
            title="Repeat Rate"
            value={`${data.summary.repeatRate}%`}
            subtitle="ordered 2+ times"
            color="yellow"
          />
          <StatCard
            title="Avg Lifetime Value"
            value={data.summary.averageLifetimeValue}
            color="default"
          />
        </div>
      )}

      {/* Loyalty Tier Distribution */}
      {data && (
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
            Loyalty Tier Distribution
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {(["CHOPSTICK", "NOODLE_MASTER", "BEEF_BOSS"] as const).map((tier) => {
              const count = data.tierDistribution[tier] || 0;
              const total = data.summary.totalCustomers || 1;
              const percent = ((count / total) * 100).toFixed(1);
              const colors = tierColors[tier];

              return (
                <div
                  key={tier}
                  style={{
                    padding: "20px",
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "8px" }}>
                    {tierIcons[tier]}
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: colors.text }}>
                    {count}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                    {percent}% of customers
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: "12px",
                      height: "6px",
                      background: "#e5e7eb",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: colors.border,
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Acquisition */}
      {data && (
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
            Customer Composition
          </h3>
          <div style={{ display: "flex", gap: "4px", height: "40px", borderRadius: "8px", overflow: "hidden" }}>
            {data.summary.newCustomers > 0 && (
              <div
                style={{
                  flex: data.summary.newCustomers,
                  background: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
                title={`${data.summary.newCustomers} new customers`}
              >
                New ({data.summary.newCustomers})
              </div>
            )}
            {data.summary.returningCustomers > 0 && (
              <div
                style={{
                  flex: data.summary.returningCustomers,
                  background: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
                title={`${data.summary.returningCustomers} returning customers`}
              >
                Returning ({data.summary.returningCustomers})
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "12px", fontSize: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#10b981", borderRadius: "2px" }} />
              <span style={{ color: "#6b7280" }}>New Customers</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#3b82f6", borderRadius: "2px" }} />
              <span style={{ color: "#6b7280" }}>Returning Customers</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Customers Table */}
      <DataTable
        title="Top Customers (by period spend)"
        columns={[
          { key: "rank", label: "Rank" },
          { key: "tier", label: "Tier" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "periodSpend", label: "Period Spend", align: "right" },
          { key: "lifetimeSpend", label: "Lifetime Spend", align: "right" },
        ]}
        data={topCustomersTableData}
      />
    </div>
  );
}
