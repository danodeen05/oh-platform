"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import PeriodSelector from "../components/PeriodSelector";
import SimpleBarChart from "../components/SimpleBarChart";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TrafficData = {
  period: string;
  summary: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    newUsers: number;
    bounceRate: string;
    avgSessionDuration: string;
  };
  timeline: Array<{
    date: string;
    activeUsers: number;
    sessions: number;
    pageViews: number;
  }>;
};

type PagesData = {
  pages: Array<{
    path: string;
    views: number;
    users: number;
    avgDuration: number;
    bounceRate: string;
  }>;
  total: number;
};

type SourcesData = {
  sources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    conversions: number;
  }>;
};

type DevicesData = {
  devices: Array<{
    device: string;
    users: number;
    sessions: number;
    pageViews: number;
    percentage: string;
  }>;
  total: number;
};

type GeoData = {
  locations: Array<{
    city: string;
    country: string;
    users: number;
    sessions: number;
  }>;
};

type RealtimeData = {
  activeUsers: number;
  topPages: Array<{
    page: string;
    users: number;
  }>;
  timestamp: string;
};

type HourlyData = {
  hourly: Array<{
    hour: number;
    hourLabel: string;
    users: number;
    sessions: number;
  }>;
  peakHour: string;
  peakUsers: number;
};

export default function TrafficPage() {
  const [period, setPeriod] = useState("week");
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [pages, setPages] = useState<PagesData | null>(null);
  const [sources, setSources] = useState<SourcesData | null>(null);
  const [devices, setDevices] = useState<DevicesData | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [hourly, setHourly] = useState<HourlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const headers = { "x-tenant-slug": "oh" };
      const [trafficRes, pagesRes, sourcesRes, devicesRes, geoRes, realtimeRes, hourlyRes] =
        await Promise.all([
          fetch(`${BASE}/analytics/ga4/traffic?period=${period}`, { headers }),
          fetch(`${BASE}/analytics/ga4/pages?period=${period}&limit=10`, { headers }),
          fetch(`${BASE}/analytics/ga4/sources?period=${period}`, { headers }),
          fetch(`${BASE}/analytics/ga4/devices?period=${period}`, { headers }),
          fetch(`${BASE}/analytics/ga4/geo?period=${period}`, { headers }),
          fetch(`${BASE}/analytics/ga4/realtime`, { headers }),
          fetch(`${BASE}/analytics/ga4/hourly?period=${period}`, { headers }),
        ]);

      if (!trafficRes.ok) {
        const err = await trafficRes.json();
        throw new Error(err.error || "Failed to fetch GA4 data");
      }

      const [trafficData, pagesData, sourcesData, devicesData, geoData, realtimeData, hourlyData] =
        await Promise.all([
          trafficRes.json(),
          pagesRes.json(),
          sourcesRes.json(),
          devicesRes.json(),
          geoRes.json(),
          realtimeRes.json(),
          hourlyRes.json(),
        ]);

      setTraffic(trafficData);
      setPages(pagesData);
      setSources(sourcesData);
      setDevices(devicesData);
      setGeo(geoData);
      setRealtime(realtimeData);
      setHourly(hourlyData);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to load GA4 data:", err);
      setError(err.message || "Failed to load GA4 analytics");
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
        const res = await fetch(`${BASE}/analytics/ga4/realtime`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (res.ok) {
          setRealtime(await res.json());
        }
      } catch (err) {
        console.error("Failed to refresh realtime:", err);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading website analytics...
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
            Website Traffic
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
          <p style={{ color: "#7f1d1d", fontSize: "0.875rem", marginTop: "16px" }}>
            To enable GA4 analytics, set GA_SERVICE_ACCOUNT_PATH or GA_SERVICE_ACCOUNT_JSON
            environment variable in your API.
          </p>
        </div>
      </div>
    );
  }

  const trafficChartData =
    traffic?.timeline?.map((t) => ({
      label: t.date.slice(5).replace("-", "/"),
      value: t.pageViews,
      formatted: `${t.pageViews} views`,
    })) || [];

  const hourlyChartData =
    hourly?.hourly?.map((h) => ({
      label: h.hourLabel,
      value: h.users,
      formatted: `${h.users} users`,
    })) || [];

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
              Website Traffic
            </h1>
            <p style={{ color: "#6b7280" }}>
              Powered by Google Analytics 4
            </p>
          </div>
          <Link
            href="/analytics/funnel"
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            View Funnel →
          </Link>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Real-time Banner */}
      {realtime && (
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
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
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>LIVE ON SITE</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "4px" }}>
                Active Users Now
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{realtime.activeUsers}</div>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: "8px" }}>
                Currently Viewing
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {realtime.topPages.slice(0, 5).map((page, i) => (
                  <span
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      padding: "4px 12px",
                      borderRadius: "16px",
                      fontSize: "0.8rem",
                    }}
                  >
                    {page.page} ({page.users})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {traffic && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            title="Active Users"
            value={traffic.summary.activeUsers.toLocaleString()}
            subtitle="unique visitors"
            icon="@"
            color="blue"
          />
          <StatCard
            title="Sessions"
            value={traffic.summary.sessions.toLocaleString()}
            subtitle="total sessions"
            icon="#"
            color="green"
          />
          <StatCard
            title="Page Views"
            value={traffic.summary.pageViews.toLocaleString()}
            subtitle="total views"
            color="yellow"
          />
          <StatCard
            title="New Users"
            value={traffic.summary.newUsers.toLocaleString()}
            subtitle="first-time visitors"
            color="default"
          />
          <StatCard
            title="Bounce Rate"
            value={traffic.summary.bounceRate}
            subtitle="single page visits"
            color="red"
          />
          <StatCard
            title="Avg Session"
            value={traffic.summary.avgSessionDuration}
            subtitle="time on site"
            color="default"
          />
        </div>
      )}

      {/* Charts Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {trafficChartData.length > 0 && (
          <SimpleBarChart
            data={trafficChartData}
            title="Page Views Over Time"
            color="#3b82f6"
            height={200}
          />
        )}
        {hourlyChartData.length > 0 && (
          <SimpleBarChart
            data={hourlyChartData}
            title={`Activity by Hour (Peak: ${hourly?.peakHour})`}
            color="#10b981"
            height={200}
          />
        )}
      </div>

      {/* Data Sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {/* Top Pages */}
        {pages && (
          <DataTable
            title="Top Pages"
            columns={[
              { key: "path", label: "Page" },
              { key: "views", label: "Views", align: "right" },
              { key: "users", label: "Users", align: "right" },
              { key: "bounceRate", label: "Bounce", align: "right" },
            ]}
            data={pages.pages.map((p) => ({
              path: p.path.length > 30 ? p.path.slice(0, 30) + "..." : p.path,
              views: p.views.toLocaleString(),
              users: p.users.toLocaleString(),
              bounceRate: p.bounceRate + "%",
            }))}
          />
        )}

        {/* Traffic Sources */}
        {sources && (
          <DataTable
            title="Traffic Sources"
            columns={[
              { key: "source", label: "Source" },
              { key: "medium", label: "Medium" },
              { key: "sessions", label: "Sessions", align: "right" },
              { key: "users", label: "Users", align: "right" },
            ]}
            data={sources.sources.slice(0, 10).map((s) => ({
              source: s.source,
              medium: s.medium,
              sessions: s.sessions.toLocaleString(),
              users: s.users.toLocaleString(),
            }))}
          />
        )}
      </div>

      {/* Device & Geo Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {/* Device Breakdown */}
        {devices && (
          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
              Device Breakdown
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {devices.devices.map((d, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 500, textTransform: "capitalize" }}>
                      {d.device}
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      {d.users.toLocaleString()} ({d.percentage}%)
                    </span>
                  </div>
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
                        height: "100%",
                        width: `${d.percentage}%`,
                        background:
                          d.device === "mobile"
                            ? "#3b82f6"
                            : d.device === "desktop"
                              ? "#10b981"
                              : "#f59e0b",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Geographic Distribution */}
        {geo && (
          <DataTable
            title="Top Locations"
            columns={[
              { key: "city", label: "City" },
              { key: "country", label: "Country" },
              { key: "users", label: "Users", align: "right" },
            ]}
            data={geo.locations.slice(0, 10).map((l) => ({
              city: l.city,
              country: l.country,
              users: l.users.toLocaleString(),
            }))}
          />
        )}
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
