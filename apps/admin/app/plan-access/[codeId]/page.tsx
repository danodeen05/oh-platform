"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, formatDate, formatMinutes, inviteLink, statusColors, type CodeDetail, type HeatRow } from "../_components/planAccess";

export default function PlanCodeDetailPage({ params }: { params: Promise<{ codeId: string }> }) {
  const { codeId } = use(params);
  const [code, setCode] = useState<CodeDetail | null>(null);
  const [heat, setHeat] = useState<HeatRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/plan/codes/${codeId}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setCode(data.code);
      setHeat(data.heat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [codeId]);

  useEffect(() => { void load(); }, [load]);

  async function answer(questionId: string) {
    const body = answers[questionId]?.trim();
    if (!body) return;
    const res = await fetch(`${API_BASE}/admin/plan/questions/${questionId}/answer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerBody: body }),
    });
    if (res.ok) void load();
  }

  if (error) return <p style={{ color: "#991b1b" }}>Error: {error}</p>;
  if (!code) return <p style={{ color: "#6b7280" }}>Loading...</p>;

  const maxSeconds = Math.max(1, ...heat.map((h) => h.seconds));
  const status = statusColors[code.status];

  return (
    <div>
      <Link href="/plan-access" style={{ color: "#6b7280", fontSize: "0.85rem", textDecoration: "none" }}>&larr; Plan Access</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 20px", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{code.label}</h1>
          <div style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: 4 }}>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>{code.code}</span> · {code.audience} · default {code.defaultScenario} ·{" "}
            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 500, backgroundColor: status.bg, color: status.text }}>{code.status}</span>
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: 4 }}>
            Sections: {code.allowedSections.length ? code.allowedSections.join(", ") : "all"} · Expires: {formatDate(code.expiresAt)} · Max sessions: {code.maxSessions ?? "unlimited"}
          </div>
        </div>
        <code style={{ fontSize: "0.8rem", background: "white", border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 6 }}>{inviteLink(code.code)}</code>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Time per section</h2>
          {heat.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No views yet.</p>}
          {heat.map((h) => (
            <div key={h.sectionKey} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 3 }}>
                <span>{h.sectionKey}</span>
                <span style={{ color: "#6b7280" }}>{formatMinutes(h.seconds)} · {h.interactions} interactions</span>
              </div>
              <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4 }}>
                <div style={{ width: `${Math.round((h.seconds / maxSeconds) * 100)}%`, height: "100%", background: "#C1502E", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </section>

        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Sessions ({code.sessions.length})</h2>
          {code.sessions.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Not opened yet.</p>}
          {code.sessions.map((s) => (
            <div key={s.id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{formatDate(s.startedAt)}</span>
                <span style={{ color: "#6b7280" }}>{formatMinutes(s.totalSeconds)}{s.country ? ` · ${s.country}` : ""}</span>
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.userAgent}</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>
                {s.sectionViews.map((v) => `${v.sectionKey} ${formatMinutes(v.seconds)}`).join(" · ") || "no sections recorded"}
              </div>
            </div>
          ))}
        </section>
      </div>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Questions ({code.questions.length})</h2>
        {code.questions.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>None submitted.</p>}
        {code.questions.map((q) => (
          <div key={q.id} style={{ borderTop: "1px solid #f3f4f6", padding: "12px 0" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{formatDate(q.createdAt)} · {q.sectionKey}{q.contactEmail ? ` · ${q.contactEmail}` : ""}</div>
            <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{q.body}</p>
            {q.answeredAt ? (
              <div style={{ background: "#f9fafb", borderLeft: "3px solid #5A5847", padding: "8px 12px", fontSize: "0.9rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Answered {formatDate(q.answeredAt)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{q.answerBody}</div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Record your answer (sent to them separately)"
                  rows={2}
                  style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }}
                />
                <button onClick={() => answer(q.id)} style={{ padding: "8px 12px", background: "#5A5847", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>Save</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
