"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import SimpleBarChart from "../components/SimpleBarChart";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type OperationsData = {
  period: string;
  dateRange: { start: string; end: string };
  metrics: {
    averagePrepTime: { value: string; unit: string; sampleSize: number };
    averageWaitTime: { value: string; unit: string; sampleSize: number };
    averageTurnaroundTime: { value: string; unit: string; sampleSize: number };
    onTimeArrivalRate: { value: string; unit: string; sampleSize: number };
  };
  statusBreakdown: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
  hourlyDistribution: Record<string, number>;
};

export default function OperationsPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch(`${BASE}/analytics/operations?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      setData(await res.json());
      setLoading(false);
    } catch (error) {
      console.error("Failed to load operations data:", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading operations analytics...
      </div>
    );
  }

  // Format hourly data for chart
  const hourlyChartData = data?.hourlyDistribution
    ? Object.entries(data.hourlyDistribution).map(([hour, count]) => ({
        label: `${hour}:00`,
        value: count,
        formatted: `${count} orders`,
      }))
    : [];

  // Status breakdown data
  const statusLabels: Record<string, string> = {
    PENDING_PAYMENT: "Pending",
    PAID: "Paid",
    QUEUED: "Queued",
    PREPPING: "Prepping",
    READY: "Ready",
    SERVING: "Serving",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const statusData = data?.statusBreakdown
    ? Object.entries(data.statusBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          status: statusLabels[status] || status,
          count,
        }))
    : [];

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
              <span style={{ color: "#374151", fontWeight: 500 }}>Operations</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Operations Analytics
            </h1>
            <p style={{ color: "#6b7280" }}>
              Monitor kitchen efficiency, wait times, and operational metrics
            </p>
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Key Metrics */}
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
            title="Avg Prep Time"
            value={`${data.metrics.averagePrepTime.value} min`}
            subtitle={`${data.metrics.averagePrepTime.sampleSize} orders`}
            color="blue"
          />
          <StatCard
            title="Avg Wait Time"
            value={`${data.metrics.averageWaitTime.value} min`}
            subtitle={`${data.metrics.averageWaitTime.sampleSize} orders`}
            color="yellow"
          />
          <StatCard
            title="Avg Turnaround"
            value={`${data.metrics.averageTurnaroundTime.value} min`}
            subtitle={`${data.metrics.averageTurnaroundTime.sampleSize} orders`}
            color="green"
          />
          <StatCard
            title="On-Time Arrivals"
            value={`${data.metrics.onTimeArrivalRate.value}%`}
            subtitle={`${data.metrics.onTimeArrivalRate.sampleSize} check-ins`}
            color="default"
          />
        </div>
      )}

      {/* Peak Hours */}
      {data?.peakHours && data.peakHours.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "#374151" }}>
            Peak Hours
          </h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {data.peakHours.map((ph, i) => (
              <div
                key={ph.hour}
                style={{
                  padding: "12px 20px",
                  background: i === 0 ? "#fef3c7" : "#f3f4f6",
                  borderRadius: "8px",
                  border: i === 0 ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "1.25rem" }}>
                  {ph.hour.toString().padStart(2, "0")}:00
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  {ph.count} orders
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Distribution */}
      {hourlyChartData.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <SimpleBarChart
            data={hourlyChartData}
            title="Orders by Hour of Day"
            color="#6366f1"
            height={200}
          />
        </div>
      )}

      {/* Status Breakdown */}
      {statusData.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "#374151" }}>
            Order Status Breakdown
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
            {statusData.map((s) => {
              const colors: Record<string, string> = {
                Completed: "#10b981",
                Prepping: "#f59e0b",
                Ready: "#3b82f6",
                Serving: "#8b5cf6",
                Queued: "#6b7280",
                Paid: "#06b6d4",
                Cancelled: "#ef4444",
                Pending: "#d1d5db",
              };
              return (
                <div
                  key={s.status}
                  style={{
                    padding: "16px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    borderLeft: `4px solid ${colors[s.status] || "#9ca3af"}`,
                  }}
                >
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#374151" }}>
                    {s.count}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.status}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
