"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TypeBreakdown = {
  type: string;
  label: string;
  emoji: string;
  count: number;
  revenue: number;
  revenueFormatted: string;
};

type ItemStat = {
  id: string;
  name: string;
  category: string;
  categoryType: string | null;
  quantity: number;
  revenue: number;
  revenueFormatted: string;
  orderCount: number;
};

type UpsellingData = {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    totalAddOnOrders: number;
    totalAddOnRevenue: number;
    totalAddOnRevenueFormatted: string;
    ordersWithAddons: number;
    totalParentOrders: number;
    conversionRate: string;
    averageAddOnValue: string;
  };
  byType: TypeBreakdown[];
  topByPopularity: ItemStat[];
  topByRevenue: ItemStat[];
};

export default function UpsellingPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<UpsellingData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(
        `${BASE}/analytics/upselling?period=${period}`,
        { headers: { "x-tenant-slug": "oh" } }
      );
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load upselling data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading upselling analytics...
      </div>
    );
  }

  const typeTableData = data?.byType?.map((t) => ({
    type: `${t.emoji} ${t.label}`,
    count: t.count,
    revenue: t.revenueFormatted,
  })) || [];

  const popularityTableData = data?.topByPopularity?.map((item) => ({
    name: item.name,
    category: item.category,
    orders: item.orderCount,
    quantity: item.quantity,
    revenue: item.revenueFormatted,
  })) || [];

  const revenueTableData = data?.topByRevenue?.map((item) => ({
    name: item.name,
    category: item.category,
    orders: item.orderCount,
    quantity: item.quantity,
    revenue: item.revenueFormatted,
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
              <span style={{ color: "#374151", fontWeight: 500 }}>Upselling</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Upselling & Add-Ons
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track add-on orders, revenue from upselling, and popular items
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
            title="Add-On Revenue"
            value={data.summary.totalAddOnRevenueFormatted}
            icon="$"
            color="green"
          />
          <StatCard
            title="Add-On Orders"
            value={data.summary.totalAddOnOrders}
            icon="#"
            color="blue"
          />
          <StatCard
            title="Conversion Rate"
            value={data.summary.conversionRate}
            subtitle="Orders with add-ons"
            color="yellow"
          />
          <StatCard
            title="Avg Add-On Value"
            value={data.summary.averageAddOnValue}
            color="default"
          />
        </div>
      )}

      {/* Add-On Type Breakdown */}
      {data && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "16px" }}>
            Breakdown by Type
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {data.byType.map((type) => (
              <div
                key={type.type}
                style={{
                  background: "white",
                  border: "2px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>{type.emoji}</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "4px" }}>
                  {type.label}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "4px" }}>
                  {type.count}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#10b981", fontWeight: 500 }}>
                  {type.revenueFormatted}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout for Tables */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Top Items by Popularity */}
        <div>
          <DataTable
            title="Most Popular Add-Ons"
            columns={[
              { key: "name", label: "Item" },
              { key: "orders", label: "Orders", align: "right" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "revenue", label: "Revenue", align: "right" },
            ]}
            data={popularityTableData}
          />
        </div>

        {/* Top Items by Revenue */}
        <div>
          <DataTable
            title="Top Revenue Add-Ons"
            columns={[
              { key: "name", label: "Item" },
              { key: "orders", label: "Orders", align: "right" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "revenue", label: "Revenue", align: "right" },
            ]}
            data={revenueTableData}
          />
        </div>
      </div>

      {/* Conversion Insight */}
      {data && data.summary.totalParentOrders > 0 && (
        <div
          style={{
            marginTop: "32px",
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "2px solid #86efac",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px", color: "#166534" }}>
            Upselling Insight
          </h3>
          <p style={{ color: "#15803d", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
            {data.summary.ordersWithAddons} out of {data.summary.totalParentOrders} orders ({data.summary.conversionRate})
            included at least one add-on. The average add-on value is {data.summary.averageAddOnValue}.
            {data.summary.totalAddOnOrders > 0 && (
              <> Consider promoting your most popular add-on items to increase upselling conversion.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
