"use client";

import { useState } from "react";
import { API_BASE, AUDIENCES, SCENARIOS, SECTION_KEYS, type Audience, type CodeRow, type Scenario } from "./planAccess";

interface Props {
  onClose: () => void;
  onCreated: (code: CodeRow) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.9rem",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 4 };

export function IssueCodeModal({ onClose, onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience>("INVESTOR");
  const [scenario, setScenario] = useState<Scenario>("BASE");
  const [allSections, setAllSections] = useState(true);
  const [sections, setSections] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxSessions, setMaxSessions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSection(key: string) {
    setSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/plan/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          audience,
          defaultScenario: scenario,
          allowedSections: allSections ? [] : sections,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          maxSessions: maxSessions ? Number(maxSessions) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not issue code");
      onCreated({ ...data.code, status: "ACTIVE", sessionCount: 0, questionCount: 0, totalSeconds: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue code");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 10, padding: 24, width: 520, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Issue plan access code</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Label (who gets this)</label>
          <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Jim R. - America First CU" required autoFocus />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Audience</label>
            <select style={inputStyle} value={audience} onChange={(e) => {
              const a = e.target.value as Audience;
              setAudience(a);
              if (a === "LENDER") setScenario("CONSERVATIVE");
            }}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Default scenario</label>
            <select style={inputStyle} value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
              {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Sections</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.9rem", marginBottom: 8 }}>
            <input type="checkbox" checked={allSections} onChange={(e) => setAllSections(e.target.checked)} /> All sections
          </label>
          {!allSections && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {SECTION_KEYS.map((key) => (
                <label key={key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
                  <input type="checkbox" checked={sections.includes(key)} onChange={() => toggleSection(key)} /> {key}
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Expires (optional)</label>
            <input style={inputStyle} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Max sessions (optional)</label>
            <input style={inputStyle} type="number" min={1} value={maxSessions} onChange={(e) => setMaxSessions(e.target.value)} placeholder="unlimited" />
          </div>
        </div>

        {error && <p style={{ color: "#991b1b", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 14px", background: "white", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={saving || !label.trim()} style={{ padding: "8px 14px", background: "#5A5847", color: "white", border: "none", borderRadius: 6, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Issuing..." : "Issue code"}
          </button>
        </div>
      </form>
    </div>
  );
}
