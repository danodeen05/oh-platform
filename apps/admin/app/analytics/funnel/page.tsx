"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type FunnelStep = {
  name: string;
  event: string;
  count: number;
  users: number;
  conversionRate: string;
  dropOff: string;
};

type FunnelData = {
  period: string;
  steps: FunnelStep[];
  overallConversionRate: string;
  totalVisitors: number;
  totalPurchases: number;
};

export default function FunnelPage() {
  const [period, setPeriod] = useState("week");
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE}/analytics/ga4/funnel?period=${period}`, {
        headers: { "x-tenant-slug": "oh" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch funnel data");
      }

      setFunnel(await res.json());
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to load funnel data:", err);
      setError(err.message || "Failed to load funnel analytics");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading funnel analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <Link
            href="/analytics"
            style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.875rem" }}
          >
            ← Back to Analytics
          </Link>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginTop: "16px" }}>
            Conversion Funnel
          </h1>
        </div>
        <div
          style={{
            padding: "48px",
            textAlign: "center",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            color: "#dc2626",
          }}
        >
          <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>
            GA4 Not Configured
          </div>
          <p style={{ color: "#991b1b" }}>{error}</p>
        </div>
      </div>
    );
  }

  // Calculate max users for bar width scaling
  const maxUsers = Math.max(...(funnel?.steps.map((s) => s.users) || [1]));

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/analytics"
          style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.875rem" }}
        >
          ← Back to Analytics
        </Link>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginTop: "16px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Order Conversion Funnel
            </h1>
            <p style={{ color: "#6b7280" }}>
              Track how visitors convert to customers through your order flow
            </p>
          </div>
          <Link
            href="/analytics/traffic"
            style={{
              padding: "8px 16px",
              background: "#f3f4f6",
              color: "#374151",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            ← Traffic Overview
          </Link>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      {funnel && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Total Visitors"
            value={funnel.totalVisitors.toLocaleString()}
            subtitle="page views"
            icon="@"
            color="blue"
          />
          <StatCard
            title="Total Purchases"
            value={funnel.totalPurchases.toLocaleString()}
            subtitle="completed orders"
            icon="$"
            color="green"
          />
          <StatCard
            title="Conversion Rate"
            value={funnel.overallConversionRate}
            subtitle="visitor to purchase"
            color="yellow"
          />
        </div>
      )}

      {/* Funnel Visualization */}
      {funnel && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "32px",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "24px" }}>
            Funnel Steps
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            {funnel.steps.map((step, i) => {
              const widthPercent = (step.users / maxUsers) * 100;
              const isLast = i === funnel.steps.length - 1;

              return (
                <div key={step.event}>
                  {/* Step Row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 1fr 120px 100px",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    {/* Step Name */}
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{step.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{step.event}</div>
                    </div>

                    {/* Funnel Bar */}
                    <div
                      style={{
                        height: "40px",
                        background: "#f3f4f6",
                        borderRadius: "8px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${widthPercent}%`,
                          background: isLast
                            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          paddingLeft: "12px",
                          color: "white",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          minWidth: "60px",
                        }}
                      >
                        {step.users.toLocaleString()}
                      </div>
                    </div>

                    {/* Conversion Rate */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: "#10b981" }}>
                        {step.conversionRate}%
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>conversion</div>
                    </div>

                    {/* Drop-off */}
                    <div style={{ textAlign: "right" }}>
                      {i > 0 && parseFloat(step.dropOff) > 0 ? (
                        <>
                          <div style={{ fontWeight: 600, color: "#ef4444" }}>-{step.dropOff}%</div>
                          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>drop-off</div>
                        </>
                      ) : (
                        <div style={{ color: "#9ca3af" }}>—</div>
                      )}
                    </div>
                  </div>

                  {/* Arrow between steps */}
                  {!isLast && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "8px 0",
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#d1d5db"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14M5 12l7 7 7-7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {funnel && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px", color: "#92400e" }}>
            💡 Insights
          </h3>
          <div style={{ display: "grid", gap: "8px", color: "#78350f" }}>
            {funnel.steps.map((step, i) => {
              if (i === 0) return null;
              const dropOff = parseFloat(step.dropOff);
              if (dropOff > 50) {
                return (
                  <p key={step.event} style={{ margin: 0 }}>
                    <strong>{dropOff}%</strong> of users drop off at "{step.name}". Consider
                    optimizing this step.
                  </p>
                );
              }
              return null;
            })}
            {parseFloat(funnel.overallConversionRate) < 1 && (
              <p style={{ margin: 0 }}>
                Your overall conversion rate is <strong>{funnel.overallConversionRate}</strong>.
                Focus on reducing friction in steps with high drop-off.
              </p>
            )}
            {parseFloat(funnel.overallConversionRate) >= 1 && (
              <p style={{ margin: 0 }}>
                Your conversion rate of <strong>{funnel.overallConversionRate}</strong> is healthy!
                Keep monitoring for opportunities to improve.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
