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

type OrderSourceData = {
  period: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
  };
  bySource: {
    [key: string]: {
      orders: number;
      revenue: number;
      revenueFormatted: string;
      averageOrderValue: number;
      aovFormatted: string;
      orderPercentage: number;
      revenuePercentage: number;
    };
  };
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("week");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [orderSources, setOrderSources] = useState<OrderSourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    try {
      if (!BASE) {
        throw new Error("API URL not configured. Set NEXT_PUBLIC_API_URL environment variable.");
      }
      const headers = { "x-tenant-slug": "oh" };
      const [overviewRes, realtimeRes, revenueRes, orderSourcesRes] = await Promise.all([
        fetch(`${BASE}/analytics/overview?period=${period}`, { headers }),
        fetch(`${BASE}/analytics/realtime`, { headers }),
        fetch(`${BASE}/analytics/revenue?period=${period}&groupBy=day`, { headers }),
        fetch(`${BASE}/analytics/order-sources?period=${period}`, { headers }),
      ]);

      if (!overviewRes.ok || !realtimeRes.ok || !revenueRes.ok || !orderSourcesRes.ok) {
        throw new Error(`API returned error: ${overviewRes.status} ${realtimeRes.status} ${revenueRes.status} ${orderSourcesRes.status}`);
      }

      const [overviewData, realtimeData, revenueData, orderSourcesData] = await Promise.all([
        overviewRes.json(),
        realtimeRes.json(),
        revenueRes.json(),
        orderSourcesRes.json(),
      ]);

      setOverview(overviewData);
      setRealtime(realtimeData);
      setRevenue(revenueData);
      setOrderSources(orderSourcesData);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
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

  if (error) {
    return (
      <div style={{ maxWidth: "600px", margin: "48px auto", textAlign: "center" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "32px",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "16px" }}>!</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "#374151" }}>
            Unable to Load Analytics
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "16px" }}>
            Could not connect to the API server. Please check your configuration.
          </p>
          <div
            style={{
              background: "#fee2e2",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "0.875rem",
              color: "#991b1b",
              fontFamily: "monospace",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            API URL: {BASE || "(not set)"}
          </div>
          <div style={{ marginTop: "24px" }}>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "#374151",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Back to Admin
            </Link>
          </div>
        </div>
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

      {/* Order Sources Breakdown */}
      {orderSources && (
        <div
          style={{
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "20px" }}>
            Orders by Source
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Web Orders */}
            <div
              style={{
                background: "#f0f9ff",
                border: "2px solid #3b82f6",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>🌐</span>
                <span style={{ fontWeight: 600, color: "#1e40af" }}>Web App</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1e40af", marginBottom: "4px" }}>
                {orderSources.bySource.WEB?.orders || 0}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#3b82f6", marginBottom: "8px" }}>
                {orderSources.bySource.WEB?.orderPercentage || 0}% of orders
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Revenue: {orderSources.bySource.WEB?.revenueFormatted || "$0.00"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                Avg: {orderSources.bySource.WEB?.aovFormatted || "$0.00"}
              </div>
            </div>

            {/* Kiosk Orders */}
            <div
              style={{
                background: "#fef3c7",
                border: "2px solid #f59e0b",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>🖥️</span>
                <span style={{ fontWeight: 600, color: "#b45309" }}>Kiosk</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#b45309", marginBottom: "4px" }}>
                {orderSources.bySource.KIOSK?.orders || 0}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#f59e0b", marginBottom: "8px" }}>
                {orderSources.bySource.KIOSK?.orderPercentage || 0}% of orders
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Revenue: {orderSources.bySource.KIOSK?.revenueFormatted || "$0.00"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                Avg: {orderSources.bySource.KIOSK?.aovFormatted || "$0.00"}
              </div>
            </div>

            {/* Mobile Orders (future) */}
            <div
              style={{
                background: "#f0fdf4",
                border: "2px solid #22c55e",
                borderRadius: "12px",
                padding: "20px",
                opacity: (orderSources.bySource.MOBILE?.orders || 0) === 0 ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>📱</span>
                <span style={{ fontWeight: 600, color: "#166534" }}>Mobile App</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
                {orderSources.bySource.MOBILE?.orders || 0}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#22c55e", marginBottom: "8px" }}>
                {orderSources.bySource.MOBILE?.orderPercentage || 0}% of orders
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Revenue: {orderSources.bySource.MOBILE?.revenueFormatted || "$0.00"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                {(orderSources.bySource.MOBILE?.orders || 0) === 0 ? "Coming soon" : `Avg: ${orderSources.bySource.MOBILE?.aovFormatted || "$0.00"}`}
              </div>
            </div>

            {/* Staff Orders */}
            <div
              style={{
                background: "#faf5ff",
                border: "2px solid #a855f7",
                borderRadius: "12px",
                padding: "20px",
                opacity: (orderSources.bySource.STAFF?.orders || 0) === 0 ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>👤</span>
                <span style={{ fontWeight: 600, color: "#7e22ce" }}>Staff Entry</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#7e22ce", marginBottom: "4px" }}>
                {orderSources.bySource.STAFF?.orders || 0}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#a855f7", marginBottom: "8px" }}>
                {orderSources.bySource.STAFF?.orderPercentage || 0}% of orders
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Revenue: {orderSources.bySource.STAFF?.revenueFormatted || "$0.00"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                Avg: {orderSources.bySource.STAFF?.aovFormatted || "$0.00"}
              </div>
            </div>
          </div>
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
          href="/analytics/traffic"
          style={{
            padding: "24px",
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            border: "2px solid #10b981",
            borderRadius: "12px",
            textDecoration: "none",
            color: "white",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>📊</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Website Traffic</h3>
          <p style={{ fontSize: "0.875rem", opacity: 0.9 }}>
            GA4-powered traffic analytics, page views, sources, and devices
          </p>
        </Link>

        <Link
          href="/analytics/funnel"
          style={{
            padding: "24px",
            background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
            border: "2px solid #8b5cf6",
            borderRadius: "12px",
            textDecoration: "none",
            color: "white",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>🎯</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Conversion Funnel</h3>
          <p style={{ fontSize: "0.875rem", opacity: 0.9 }}>
            Order funnel with drop-off rates and conversion tracking
          </p>
        </Link>

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

        <Link
          href="/analytics/upselling"
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
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>+</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Upselling & Add-Ons</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Add-on revenue, item popularity, and conversion rates
          </p>
        </Link>

        <Link
          href="/analytics/languages"
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
          <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>A</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "8px" }}>Language Analytics</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Browser languages, localization opportunities, and visitor demographics
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
