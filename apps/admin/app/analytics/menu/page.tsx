"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type MenuData = {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalItemsSold: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
    uniqueItems: number;
  };
  topByQuantity: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    revenueFormatted: string;
  }>;
  topByRevenue: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    revenueFormatted: string;
  }>;
  byCategory: Array<{
    category: string;
    quantity: number;
    revenue: number;
    revenueFormatted: string;
    percentOfRevenue: string;
  }>;
};

export default function MenuPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BASE}/analytics/menu?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      const json = await res.json();
      // Check if response has expected structure
      if (json.summary) {
        setData(json);
      } else {
        // Set empty data structure on error
        setData({
          period,
          dateRange: { start: "", end: "" },
          summary: { totalItemsSold: 0, totalRevenue: 0, totalRevenueFormatted: "$0.00", uniqueItems: 0 },
          topByQuantity: [],
          topByRevenue: [],
          byCategory: [],
        });
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load menu data:", error);
      setData({
        period,
        dateRange: { start: "", end: "" },
        summary: { totalItemsSold: 0, totalRevenue: 0, totalRevenueFormatted: "$0.00", uniqueItems: 0 },
        topByQuantity: [],
        topByRevenue: [],
        byCategory: [],
      });
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading menu analytics...
      </div>
    );
  }

  const topByQuantityTableData = data?.topByQuantity?.map((item, i) => ({
    rank: `#${i + 1}`,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    revenue: item.revenueFormatted,
  })) || [];

  const topByRevenueTableData = data?.topByRevenue?.map((item, i) => ({
    rank: `#${i + 1}`,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    revenue: item.revenueFormatted,
  })) || [];

  const categoryColors = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  ];

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
              <span style={{ color: "#374151", fontWeight: 500 }}>Menu</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Menu Performance
            </h1>
            <p style={{ color: "#6b7280" }}>
              Analyze item popularity, category performance, and sales trends
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
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Total Items Sold"
            value={data.summary.totalItemsSold.toLocaleString()}
            color="blue"
          />
          <StatCard
            title="Menu Revenue"
            value={data.summary.totalRevenueFormatted}
            color="green"
          />
          <StatCard
            title="Unique Items Ordered"
            value={data.summary.uniqueItems}
            color="default"
          />
          <StatCard
            title="Avg Items Per Order"
            value={data.summary.totalItemsSold > 0
              ? (data.summary.totalItemsSold / Math.max(1, data.topByQuantity?.length || 1)).toFixed(1)
              : "0"
            }
            color="yellow"
          />
        </div>
      )}

      {/* Category Breakdown */}
      {data?.byCategory && data.byCategory.length > 0 && (
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
            Revenue by Category
          </h3>

          {/* Visual bar breakdown */}
          <div style={{ display: "flex", gap: "2px", height: "32px", borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
            {data.byCategory.map((cat, i) => (
              <div
                key={cat.category}
                style={{
                  flex: parseFloat(cat.percentOfRevenue),
                  background: categoryColors[i % categoryColors.length],
                  minWidth: parseFloat(cat.percentOfRevenue) > 5 ? "auto" : "4px",
                }}
                title={`${cat.category}: ${cat.revenueFormatted} (${cat.percentOfRevenue}%)`}
              />
            ))}
          </div>

          {/* Category cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            {data.byCategory.map((cat, i) => (
              <div
                key={cat.category}
                style={{
                  padding: "16px",
                  background: "#f9fafb",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${categoryColors[i % categoryColors.length]}`,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "4px", color: "#374151" }}>
                  {cat.category}
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#374151" }}>
                  {cat.revenueFormatted}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {cat.quantity} sold ({cat.percentOfRevenue}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Items Tables - Side by Side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        {/* Top by Quantity */}
        <DataTable
          title="Top Items by Quantity"
          columns={[
            { key: "rank", label: "#" },
            { key: "name", label: "Item" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
          ]}
          data={topByQuantityTableData}
        />

        {/* Top by Revenue */}
        <DataTable
          title="Top Items by Revenue"
          columns={[
            { key: "rank", label: "#" },
            { key: "name", label: "Item" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
          ]}
          data={topByRevenueTableData}
        />
      </div>
    </div>
  );
}
