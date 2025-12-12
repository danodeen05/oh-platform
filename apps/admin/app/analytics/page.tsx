"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";
import PeriodSelector from "./components/PeriodSelector";
import SimpleBarChart from "./components/SimpleBarChart";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type OverviewData = {
  period: string;
  dateRange: { start: string; end: string };
  metrics: {
    totalRevenue: { value: number; formatted: string; change: string };
    totalOrders: { value: number; change: string };
    averageOrderValue: { value: number; formatted: string; change: string };
    uniqueCustomers: { value: number; change: string };
  };
};

type RealtimeData = {
  today: {
    orders: number;
    revenue: number;
    revenueFormatted: string;
    completed: number;
  };
  live: {
    activeOrders: number;
    queueLength: number;
  };
};

type RevenueData = {
  timeline: Array<{
    date: string;
    revenue: number;
    revenueFormatted: string;
    orders: number;
  }>;
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("week");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const headers = { "x-tenant-slug": "oh" };
      const [overviewRes, realtimeRes, revenueRes] = await Promise.all([
        fetch(`${BASE}/analytics/overview?period=${period}`, { headers }),
        fetch(`${BASE}/analytics/realtime`, { headers }),
        fetch(`${BASE}/analytics/revenue?period=${period}&groupBy=day`, { headers }),
      ]);

      const [overviewData, realtimeData, revenueData] = await Promise.all([
        overviewRes.json(),
        realtimeRes.json(),
        revenueRes.json(),
      ]);

      setOverview(overviewData);
      setRealtime(realtimeData);
      setRevenue(revenueData);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  // Refresh realtime data every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/analytics/realtime`, {
          headers: { "x-tenant-slug": "oh" },
        });
        setRealtime(await res.json());
      } catch (error) {
        console.error("Failed to refresh realtime:", error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading analytics...
      </div>
    );
  }

  const chartData = revenue?.timeline?.map((t) => ({
    label: t.date.split("-").slice(1).join("/"),
    value: t.revenue / 100,
    formatted: t.revenueFormatted,
  })) || [];

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Analytics Dashboard
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track your restaurant performance and make data-driven decisions
            </p>
          </div>
          <Link
            href="/"
            style={{
              padding: "8px 16px",
              background: "#f3f4f6",
              borderRadius: "8px",
              textDecoration: "none",
              color: "#374151",
              fontSize: "0.875rem",
            }}
          >
            Back to Admin
          </Link>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Live Stats Banner */}
      {realtime && (
        <div
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "#4ade80",
                borderRadius: "50%",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>LIVE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "24px" }}>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>Today&apos;s Revenue</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{realtime.today.revenueFormatted}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>Orders Today</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{realtime.today.orders}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>Active Orders</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{realtime.live.activeOrders}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>Queue Length</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{realtime.live.queueLength}</div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {overview && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Total Revenue"
            value={overview.metrics.totalRevenue.formatted}
            change={overview.metrics.totalRevenue.change}
            subtitle="vs previous period"
            icon="$"
            color="green"
          />
          <StatCard
            title="Total Orders"
            value={overview.metrics.totalOrders.value}
            change={overview.metrics.totalOrders.change}
            subtitle="vs previous period"
            icon="#"
            color="blue"
          />
          <StatCard
            title="Average Order Value"
            value={overview.metrics.averageOrderValue.formatted}
            change={overview.metrics.averageOrderValue.change}
            subtitle="vs previous period"
            color="yellow"
          />
          <StatCard
            title="Unique Customers"
            value={overview.metrics.uniqueCustomers.value}
            change={overview.metrics.uniqueCustomers.change}
            subtitle="vs previous period"
            color="default"
          />
        </div>
      )}

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <SimpleBarChart data={chartData} title="Revenue Over Time" color="#10b981" height={180} />
        </div>
      )}

      {/* Quick Links to Detailed Reports */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        <Link
          href="/analytics/revenue"
          style={{
            padding: "24px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>$</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Revenue Analytics</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Detailed revenue breakdowns, trends, and location comparisons
          </p>
        </Link>

        <Link
          href="/analytics/operations"
          style={{
            padding: "24px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>*</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Operations</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Prep times, wait times, peak hours, and efficiency metrics
          </p>
        </Link>

        <Link
          href="/analytics/customers"
          style={{
            padding: "24px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>@</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Customer Insights</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            New vs returning, loyalty tiers, and customer lifetime value
          </p>
        </Link>

        <Link
          href="/analytics/menu"
          style={{
            padding: "24px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>#</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Menu Performance</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Top sellers, category breakdown, and item-level analytics
          </p>
        </Link>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
