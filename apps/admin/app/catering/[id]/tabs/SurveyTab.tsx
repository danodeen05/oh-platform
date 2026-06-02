"use client";

import { useState, useEffect } from "react";
import StatCard from "../../../analytics/components/StatCard";
import SimpleBarChart from "../../../analytics/components/SimpleBarChart";
import DataTable from "../../../analytics/components/DataTable";
import type { SurveyStats } from "../../_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface SurveyTabProps {
  eventId: string;
}

export default function SurveyTab({ eventId }: SurveyTabProps) {
  const [survey, setSurvey] = useState<SurveyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSurvey = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE}/admin/catering/events/${eventId}/survey`);
        if (!res.ok) {
          setSurvey(null);
          return;
        }
        const data: SurveyStats = await res.json();
        setSurvey(data);
      } catch (err) {
        console.error("Failed to fetch survey:", err);
        setSurvey(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSurvey();
  }, [eventId]);

  if (loading) {
    return <p style={{ color: "#6b7280" }}>Loading...</p>;
  }

  if (!survey) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#9ca3af",
          backgroundColor: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        No survey data available yet.
      </div>
    );
  }

  // The API returns { overallScore, areaAverages, responseCount, responses[] }.
  // Be defensive: responses/areaAverages may be absent for an event with no
  // survey activity yet.
  const responses = survey.responses || [];
  const areas = survey.areaAverages || { food: 0, speed: 0, experience: 0, recommend: 0 };
  const responseCount = survey.responseCount ?? responses.length;
  const score = survey.overallScore ?? 0;
  const scoreColor: "green" | "yellow" | "red" =
    score >= 4.0 ? "green" : score >= 3.0 ? "yellow" : "red";

  const areaData = [
    { label: "Food", value: areas.food ?? 0 },
    { label: "Speed", value: areas.speed ?? 0 },
    { label: "Experience", value: areas.experience ?? 0 },
    { label: "Recommend", value: areas.recommend ?? 0 },
  ];

  const minArea = areaData.length ? Math.min(...areaData.map((a) => a.value)) : 0;

  const commentRows = responses
    .filter((r) => r.comment)
    .map((r) => ({
      name: r.guestName || "Anonymous",
      comment: r.comment as string,
      date: new Date(r.createdAt).toLocaleDateString(),
    }));

  return (
    <div>
      {/* Overall Score */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          title="Overall Score"
          value={`${score.toFixed(1)} / 5`}
          subtitle={`${responseCount} response${responseCount !== 1 ? "s" : ""}`}
          color={scoreColor}
        />
        {areaData.map((a) => (
          <StatCard
            key={a.label}
            title={a.label}
            value={`${a.value.toFixed(1)} / 5`}
            color={a.value === minArea && a.value < 4 ? "red" : "default"}
          />
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom: 24 }}>
        <SimpleBarChart
          title="Area Averages"
          data={areaData.map((a) => ({
            label: a.label,
            value: a.value,
            formatted: `${a.value.toFixed(1)}/5`,
          }))}
          color={minArea < 3.0 ? "#ef4444" : "#10b981"}
          height={160}
        />
      </div>

      {/* AI Summary */}
      {survey.aiSummary && (
        <div
          style={{
            backgroundColor: "#eff6ff",
            borderRadius: 8,
            padding: 16,
            border: "1px solid #bfdbfe",
            marginBottom: 24,
          }}
        >
          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: 8, fontSize: "0.9rem" }}>
            AI Summary
          </div>
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.6, fontSize: "0.9rem" }}>
            {survey.aiSummary}
          </p>
        </div>
      )}

      {/* Comments table */}
      {commentRows.length > 0 ? (
        <DataTable
          title={`Comments (${commentRows.length})`}
          columns={[
            { key: "name", label: "Attendee" },
            { key: "comment", label: "Comment" },
            { key: "date", label: "Date" },
          ]}
          data={commentRows as Record<string, unknown>[]}
          expandable
          defaultLimit={10}
        />
      ) : (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#9ca3af",
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          No written comments yet.
        </div>
      )}
    </div>
  );
}
