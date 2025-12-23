"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Language display names for better readability
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (Australia)",
  "zh-TW": "Traditional Chinese (Taiwan)",
  "zh-CN": "Simplified Chinese (China)",
  "zh-HK": "Traditional Chinese (Hong Kong)",
  zh: "Chinese",
  es: "Spanish",
  "es-ES": "Spanish (Spain)",
  "es-MX": "Spanish (Mexico)",
  fr: "French",
  "fr-FR": "French (France)",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  "pt-BR": "Portuguese (Brazil)",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  tl: "Tagalog",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  uk: "Ukrainian",
  cs: "Czech",
  sv: "Swedish",
  da: "Danish",
  fi: "Finnish",
  no: "Norwegian",
  he: "Hebrew",
  el: "Greek",
  ro: "Romanian",
  hu: "Hungarian",
};

const getLanguageName = (code: string) => {
  return LANGUAGE_NAMES[code] || LANGUAGE_NAMES[code.split("-")[0]] || code;
};

type LanguageData = {
  summary: {
    totalVisits: number;
    uniqueLanguages: number;
    unsupportedLanguageVisits: number;
    supportedLanguageVisits: number;
  };
  allLanguages: Array<{
    language: string;
    count: number;
    percentage: string;
    isSupported: boolean;
  }>;
  unsupportedLanguages: Array<{
    language: string;
    count: number;
    percentage: string;
  }>;
  resolvedLocales: Array<{
    locale: string;
    count: number;
    percentage: string;
  }>;
  dailyBreakdown: Array<{
    date: string;
    total: number;
    supported: number;
    unsupported: number;
  }>;
  period: {
    days: number;
    from: string;
    to: string;
  };
};

export default function LanguagesPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<LanguageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/analytics/language?days=${days}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err) {
      console.error("Failed to load language data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [days]);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
        Loading language analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: "600px", margin: "48px auto", textAlign: "center" }}>
        <div
          style={{
            background: error ? "#fef2f2" : "#f3f4f6",
            border: `1px solid ${error ? "#fecaca" : "#e5e7eb"}`,
            borderRadius: "12px",
            padding: "32px",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "16px" }}>
            {error ? "!" : "A"}
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "#374151" }}>
            {error ? "Unable to Load Language Analytics" : "No Data Yet"}
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "16px" }}>
            {error
              ? "The language analytics feature requires the database to be updated. Please run the database migration."
              : "Language tracking will begin collecting data as users visit the site."}
          </p>
          {error && (
            <div
              style={{
                background: "#fee2e2",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "0.875rem",
                color: "#991b1b",
                fontFamily: "monospace",
              }}
            >
              {error}
            </div>
          )}
          <div style={{ marginTop: "24px" }}>
            <Link
              href="/analytics"
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
              Back to Analytics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allLanguagesTableData = data.allLanguages.map((l, i) => ({
    rank: `#${i + 1}`,
    language: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{getLanguageName(l.language)}</span>
        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>({l.language})</span>
      </div>
    ),
    visits: l.count,
    percentage: `${l.percentage}%`,
    status: l.isSupported ? (
      <span style={{ color: "#10b981", fontWeight: 500 }}>Supported</span>
    ) : (
      <span style={{ color: "#f59e0b", fontWeight: 500 }}>Not Supported</span>
    ),
  }));

  const unsupportedTableData = data.unsupportedLanguages.map((l, i) => ({
    rank: `#${i + 1}`,
    language: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{getLanguageName(l.language)}</span>
        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>({l.language})</span>
      </div>
    ),
    visits: l.count,
    percentage: `${l.percentage}%`,
  }));

  const resolvedLocalesData = data.resolvedLocales.map((l) => ({
    locale: getLanguageName(l.locale),
    code: l.locale,
    visits: l.count,
    percentage: `${l.percentage}%`,
  }));

  // Calculate supported percentage
  const supportedPct = data.summary.totalVisits > 0
    ? ((data.summary.supportedLanguageVisits / data.summary.totalVisits) * 100).toFixed(1)
    : "0";

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
              <span style={{ color: "#374151", fontWeight: 500 }}>Languages</span>
            </div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "8px" }}>
              Language Analytics
            </h1>
            <p style={{ color: "#6b7280" }}>
              Understand your visitors&apos; language preferences and identify opportunities for localization
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: days === d ? "#1f2937" : "white",
                color: days === d ? "white" : "#374151",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <StatCard
          title="Total Visits"
          value={data.summary.totalVisits}
          subtitle={`last ${days} days`}
          color="blue"
        />
        <StatCard
          title="Unique Languages"
          value={data.summary.uniqueLanguages}
          subtitle="detected"
          color="default"
        />
        <StatCard
          title="Supported Language"
          value={`${supportedPct}%`}
          subtitle={`${data.summary.supportedLanguageVisits} visits`}
          color="green"
        />
        <StatCard
          title="Unsupported Languages"
          value={data.summary.unsupportedLanguageVisits}
          subtitle="opportunities for localization"
          color="yellow"
        />
      </div>

      {/* Resolved Locales (what was actually shown) */}
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
          Locales Served
        </h3>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "20px" }}>
          What language version visitors actually saw on the site
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {resolvedLocalesData.map((locale) => {
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              en: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
              "zh-TW": { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
              "zh-CN": { bg: "#fef2f2", border: "#f87171", text: "#991b1b" },
              es: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
            };
            const c = colors[locale.code] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };

            return (
              <div
                key={locale.code}
                style={{
                  padding: "20px",
                  background: c.bg,
                  border: `2px solid ${c.border}`,
                  borderRadius: "12px",
                }}
              >
                <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "4px" }}>
                  {locale.locale}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "8px" }}>
                  {locale.code}
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: c.text }}>
                  {locale.visits}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                  {locale.percentage} of visits
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
                      width: locale.percentage,
                      height: "100%",
                      background: c.border,
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unsupported Languages - Key insight for potential localization */}
      {unsupportedTableData.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            borderRadius: "12px",
            border: "2px solid #f59e0b",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "1.5rem" }}>!</span>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#92400e" }}>
              Localization Opportunities
            </h3>
          </div>
          <p style={{ color: "#78350f", fontSize: "0.875rem", marginBottom: "20px" }}>
            These languages are requested by visitors but not currently supported. Consider adding translations to better serve these demographics.
          </p>
          <DataTable
            title=""
            columns={[
              { key: "rank", label: "Rank" },
              { key: "language", label: "Language" },
              { key: "visits", label: "Visits", align: "right" },
              { key: "percentage", label: "% of Total", align: "right" },
            ]}
            data={unsupportedTableData}
          />
        </div>
      )}

      {/* All Browser Languages Table */}
      <DataTable
        title="All Detected Browser Languages"
        columns={[
          { key: "rank", label: "Rank" },
          { key: "language", label: "Language" },
          { key: "visits", label: "Visits", align: "right" },
          { key: "percentage", label: "% of Total", align: "right" },
          { key: "status", label: "Status" },
        ]}
        data={allLanguagesTableData}
      />

      {/* Info Note */}
      <div
        style={{
          marginTop: "32px",
          padding: "16px",
          background: "#f3f4f6",
          borderRadius: "8px",
          fontSize: "0.875rem",
          color: "#6b7280",
        }}
      >
        <strong>How this works:</strong> Language data is collected from visitors&apos; browser settings (Accept-Language header).
        This represents the languages users prefer, not necessarily what they can read.
        When a visitor&apos;s preferred language isn&apos;t supported, they&apos;re shown the closest available locale or English by default.
      </div>
    </div>
  );
}
