"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import SimpleBarChart from "../components/SimpleBarChart";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type RevenueData = {
  period: string;
  groupBy: string;
  dateRange: { start: string; end: string };
  summary: {
    totalRevenue: number;
    totalRevenueFormatted: string;
    totalOrders: number;
    averageOrderValue: number;
    averageOrderValueFormatted: string;
  };
  timeline: Array<{
    date: string;
    revenue: number;
    revenueFormatted: string;
    orders: number;
  }>;
  byLocation: Array<{
    locationId: string;
    name: string;
    revenue: number;
    revenueFormatted: string;
    orders: number;
  }>;
};

export default function RevenuePage() {
  const [period, setPeriod] = useState("week");
  const [groupBy, setGroupBy] = useState("day");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(
        `${BASE}/analytics/revenue?period=${period}&groupBy=${groupBy}`,
        { headers: { "x-tenant-slug": "oh" } }
      );
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load revenue data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period, groupBy]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading revenue analytics...
      </div>
    );
  }

  const chartData = data?.timeline?.map((t) => ({
    label: t.date.includes(" ") ? t.date.split(" ")[1] : t.date.split("-").slice(1).join("/"),
    value: t.revenue / 100,
    formatted: t.revenueFormatted,
  })) || [];

  const locationTableData = data?.byLocation?.map((loc) => ({
    name: loc.name,
    revenue: loc.revenueFormatted,
    orders: loc.orders,
    avgOrder: loc.orders > 0 ? `$${((loc.revenue / loc.orders) / 100).toFixed(2)}` : "$0.00",
  })) || [];

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Link
                href="/analytics"
                style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.875rem" }}
              >
                Analytics
              </Link>
              <span style={{ color: "#d1d5db" }}>/</span>
              <span style={{ color: "#374151", fontWeight: 500 }}>Revenue</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Revenue Analytics
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track revenue trends, compare locations, and understand your sales patterns
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <PeriodSelector value={period} onChange={setPeriod} />
          <div style={{ display: "flex", gap: "8px" }}>
            {["hour", "day", "week", "month"].map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: groupBy === g ? "#6b7280" : "#e5e7eb",
                  background: groupBy === g ? "#374151" : "white",
                  color: groupBy === g ? "white" : "#6b7280",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  textTransform: "capitalize",
                }}
              >
                By {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Total Revenue"
            value={data.summary.totalRevenueFormatted}
            icon="$"
            color="green"
          />
          <StatCard
            title="Total Orders"
            value={data.summary.totalOrders}
            icon="#"
            color="blue"
          />
          <StatCard
            title="Average Order Value"
            value={data.summary.averageOrderValueFormatted}
            color="yellow"
          />
          <StatCard
            title="Revenue Per Order"
            value={data.summary.totalOrders > 0
              ? `$${((data.summary.totalRevenue / data.summary.totalOrders) / 100).toFixed(2)}`
              : "$0.00"
            }
            color="default"
          />
        </div>
      )}

      {/* Revenue Timeline Chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <SimpleBarChart
            data={chartData}
            title={`Revenue by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}
            color="#10b981"
            height={220}
          />
        </div>
      )}

      {/* Revenue by Location */}
      <div style={{ marginBottom: "32px" }}>
        <DataTable
          title="Revenue by Location"
          columns={[
            { key: "name", label: "Location" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "orders", label: "Orders", align: "right" },
            { key: "avgOrder", label: "Avg Order", align: "right" },
          ]}
          data={locationTableData}
        />
      </div>

      {/* Orders Timeline */}
      {data?.timeline && data.timeline.length > 0 && (
        <div>
          <SimpleBarChart
            data={data.timeline.map((t) => ({
              label: t.date.includes(" ") ? t.date.split(" ")[1] : t.date.split("-").slice(1).join("/"),
              value: t.orders,
              formatted: `${t.orders} orders`,
            }))}
            title="Orders Over Time"
            color="#3b82f6"
            height={180}
          />
        </div>
      )}
    </div>
  );
}
