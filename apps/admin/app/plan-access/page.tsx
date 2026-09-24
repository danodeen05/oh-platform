"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IssueCodeModal } from "./_components/IssueCodeModal";
import { API_BASE, formatDate, formatMinutes, inviteLink, statusColors, type CodeRow } from "./_components/planAccess";

function StatusBadge({ status }: { status: CodeRow["status"] }) {
  const c = statusColors[status];
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 500, backgroundColor: c.bg, color: c.text }}>{status}</span>;
}

export default function PlanAccessPage() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [justIssued, setJustIssued] = useState<CodeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/plan/codes`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setCodes(data.codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function copyLink(code: CodeRow) {
    try {
      await navigator.clipboard.writeText(inviteLink(code.code));
      setCopied(code.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link", inviteLink(code.code));
    }
  }

  async function revoke(code: CodeRow) {
    if (!window.confirm(`Revoke access for "${code.label}"? Their link stops working immediately.`)) return;
    const res = await fetch(`${API_BASE}/admin/plan/codes/${code.id}/revoke`, { method: "PATCH" });
    if (res.ok) void load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Plan Access</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>Per-recipient codes for the interactive business plan, with view analytics.</p>
        </div>
        <button onClick={() => setShowIssue(true)} style={{ padding: "10px 16px", background: "#5A5847", color: "white", border: "none", borderRadius: 6, fontWeight: 500, cursor: "pointer" }}>
          Issue code
        </button>
      </div>

      {justIssued && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Code issued for {justIssued.label}</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "1.2rem", letterSpacing: "0.08em", marginBottom: 8 }}>{justIssued.code}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: "0.85rem", background: "white", padding: "4px 8px", borderRadius: 4 }}>{inviteLink(justIssued.code)}</code>
            <button onClick={() => copyLink(justIssued)} style={{ padding: "6px 10px", border: "1px solid #d1d5db", background: "white", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>
              {copied === justIssued.id ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#991b1b" }}>Error: {error}</p>}

      <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase" }}>
              {["Label", "Audience", "Scenario", "Created", "Last viewed", "Sessions", "Time", "Questions", "Status", ""].map((h) => (
                <th key={h} style={{ padding: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>}
            {!loading && codes.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>No codes yet. Issue the first one.</td></tr>}
            {codes.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>
                  <Link href={`/plan-access/${c.id}`} style={{ fontWeight: 500, color: "#111827", textDecoration: "none" }}>{c.label}</Link>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#6b7280" }}>{c.code}</div>
                </td>
                <td style={{ padding: 12 }}>{c.audience}</td>
                <td style={{ padding: 12 }}>{c.defaultScenario}</td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatDate(c.createdAt)}</td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatDate(c.lastViewedAt)}</td>
                <td style={{ padding: 12 }}>{c.sessionCount}{c.maxSessions ? ` / ${c.maxSessions}` : ""}</td>
                <td style={{ padding: 12 }}>{formatMinutes(c.totalSeconds)}</td>
                <td style={{ padding: 12 }}>{c.questionCount}</td>
                <td style={{ padding: 12 }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  <button onClick={() => copyLink(c)} disabled={c.status !== "ACTIVE"} style={{ padding: "4px 10px", border: "1px solid #d1d5db", background: "white", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", marginRight: 6 }}>
                    {copied === c.id ? "Copied" : "Copy link"}
                  </button>
                  {c.status === "ACTIVE" && (
                    <button onClick={() => revoke(c)} style={{ padding: "4px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showIssue && (
        <IssueCodeModal
          onClose={() => setShowIssue(false)}
          onCreated={(code) => { setShowIssue(false); setJustIssued(code); void load(); }}
        />
      )}
    </div>
  );
}
