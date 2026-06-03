"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Blackout {
  id: string;
  weekday: number | null;
  startDate: string | null;
  endDate: string | null;
  slot: "LUNCH" | "DINNER" | null;
  reason: string | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function slotLabel(slot: Blackout["slot"]) {
  if (slot === "LUNCH") return "Lunch only";
  if (slot === "DINNER") return "Dinner only";
  return "Whole day";
}

function describe(b: Blackout): string {
  const scope = slotLabel(b.slot);
  if (b.weekday !== null && b.weekday !== undefined) {
    return `Every ${WEEKDAYS[b.weekday]} · ${scope}`;
  }
  const start = b.startDate?.slice(0, 10);
  const end = b.endDate?.slice(0, 10);
  if (start && end && start !== end) return `${start} → ${end} · ${scope}`;
  return `${start} · ${scope}`;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.9rem",
};

export default function BlackoutManager() {
  const [rows, setRows] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [mode, setMode] = useState<"date" | "weekday">("date");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [weekday, setWeekday] = useState("0");
  const [slot, setSlot] = useState<"" | "LUNCH" | "DINNER">("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/catering/blackouts`);
      if (!res.ok) throw new Error("Failed to load blocked dates");
      setRows(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/catering/blackouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to add block");
      }
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const slotVal = slot || undefined;
    const reasonVal = reason.trim() || undefined;
    if (mode === "weekday") {
      await create({ weekday: Number(weekday), slot: slotVal, reason: reasonVal });
    } else {
      if (!startDate) {
        setError("Pick a start date");
        return;
      }
      const ok = await create({
        startDate,
        endDate: endDate || undefined,
        slot: slotVal,
        reason: reasonVal,
      });
      if (ok) {
        setStartDate("");
        setEndDate("");
      }
    }
    setReason("");
  };

  const remove = async (id: string) => {
    setRows((r) => r.filter((b) => b.id !== id)); // optimistic
    await fetch(`${BASE}/admin/catering/blackouts/${id}`, { method: "DELETE" });
    load();
  };

  const sundaysBlocked = rows.some((b) => b.weekday === 0 && b.slot === null);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 20,
        background: "white",
        marginBottom: 24,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: "#111827" }}>
        Blocked Dates &amp; Slots
      </h3>
      <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: "0.85rem" }}>
        Dates and slots blocked here are removed from the public booking calendar and
        rejected at checkout.
      </p>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          onClick={() => create({ weekday: 0, reason: "Closed Sundays" })}
          disabled={saving || sundaysBlocked}
          style={{
            padding: "8px 14px",
            background: sundaysBlocked ? "#f3f4f6" : "#4f46e5",
            color: sundaysBlocked ? "#9ca3af" : "white",
            border: "none",
            borderRadius: 6,
            cursor: sundaysBlocked ? "default" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          {sundaysBlocked ? "✓ Sundays blocked" : "Block all Sundays"}
        </button>
      </div>

      {/* Add form */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: 14,
          background: "#f9fafb",
          borderRadius: 8,
          marginBottom: 18,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280" }}>
          Type
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={inputStyle}>
            <option value="date">Specific date / range</option>
            <option value="weekday">Recurring weekday</option>
          </select>
        </label>

        {mode === "date" ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280" }}>
              From
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280" }}>
              To (optional)
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </label>
          </>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280" }}>
            Weekday
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)} style={inputStyle}>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>{w}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280" }}>
          Slot
          <select value={slot} onChange={(e) => setSlot(e.target.value as any)} style={inputStyle}>
            <option value="">Whole day</option>
            <option value="LUNCH">Lunch only</option>
            <option value="DINNER">Dinner only</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#6b7280", flex: 1, minWidth: 140 }}>
          Reason (optional)
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday, private event…" style={inputStyle} />
        </label>

        <button
          onClick={handleAdd}
          disabled={saving}
          style={{
            padding: "9px 18px",
            background: "#059669",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: saving ? "default" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Block"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: "0 0 12px" }}>{error}</p>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Nothing blocked yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 14px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            >
              <div>
                <span style={{ fontSize: "0.9rem", color: "#111827", fontWeight: 500 }}>{describe(b)}</span>
                {b.reason && (
                  <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: 8 }}>— {b.reason}</span>
                )}
              </div>
              <button
                onClick={() => remove(b.id)}
                style={{
                  padding: "5px 12px",
                  background: "white",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
