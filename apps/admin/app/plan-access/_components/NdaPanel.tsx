"use client";

/** NDA status, signer details, audit trail and actions for one plan code. */

import { useCallback, useEffect, useState } from "react";
import { API_BASE, formatDate } from "./planAccess";
import { addressLine, downloadNdaPdf, type NdaAdminDetail } from "./nda";

const pill = (bg: string, color: string): React.CSSProperties => ({ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 500, background: bg, color });
const btn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #d1d5db", background: "white", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" };

export function NdaPanel({ codeId }: { codeId: string }) {
  const [data, setData] = useState<NdaAdminDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/plan/codes/${codeId}/nda`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [codeId]);
  useEffect(() => { void load(); }, [load]);

  async function act(label: string, fn: () => Promise<Response | void>) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fn();
      if (res && !res.ok) throw new Error(`API ${res.status}`);
      setNote(label);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const post = (path: string) => fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

  if (error) return <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 20 }}><p style={{ color: "#991b1b", margin: 0 }}>NDA: {error}</p></section>;
  if (!data) return null;
  const cur = data.current;
  const d = cur?.details;
  const a = cur?.audit;
  const status = cur?.status === "SIGNED" ? pill("#dcfce7", "#166534") : data.ndaRequired ? pill("#fef3c7", "#92400e") : pill("#f3f4f6", "#374151");
  const statusText = cur?.status === "SIGNED" ? `Signed ${formatDate(a?.signedAt ?? null)}` : data.ndaRequired ? (d ? "In progress" : "Awaiting signature") : "Not required";
  const row = (k: string, v: React.ReactNode) => (
    <tr><td style={{ padding: "4px 12px 4px 0", color: "#6b7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td><td style={{ padding: "4px 0", wordBreak: "break-word" }}>{v}</td></tr>
  );

  return (
    <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>NDA <span style={status}>{statusText}</span></h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cur?.status === "SIGNED" && (
            <>
              <button style={btn} disabled={busy} onClick={() => void act("Downloaded", () => downloadNdaPdf(cur.id))}>Download PDF</button>
              <button style={btn} disabled={busy} onClick={() => void act("Copy resent by email and text", () => post(`/admin/plan/ndas/${cur.id}/resend`))}>Resend copy</button>
              <button
                style={{ ...btn, borderColor: "#fecaca", color: "#991b1b", background: "#fef2f2" }}
                disabled={busy}
                onClick={() => { if (window.confirm("Void this NDA? If the code still requires an NDA, the recipient must sign again before seeing the plan.")) void act("Voided", () => post(`/admin/plan/ndas/${cur.id}/void`)); }}
              >
                Void
              </button>
            </>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", marginLeft: 6 }}>
            <input
              type="checkbox"
              checked={data.ndaRequired}
              disabled={busy}
              onChange={(e) => {
                const required = e.target.checked;
                void act(required ? "NDA now required" : "NDA no longer required", () =>
                  fetch(`${API_BASE}/admin/plan/codes/${codeId}/nda`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ required }) }),
                );
              }}
            />
            Require NDA
          </label>
        </div>
      </div>
      {note && <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#374151" }}>{note}</p>}
      {a?.deliveryError && <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#991b1b" }}>Delivery problem: {a.deliveryError}</p>}
      {d && a ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, marginTop: 12 }}>
          <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <tbody>
              {row("Legal name", d.legalName)}
              {row("Email", d.email)}
              {row("Mobile", `${d.phone}${a.phoneVerifiedAt ? " (verified)" : " (not verified)"}`)}
              {row("Address", addressLine(d.address))}
              {d.company ? row("On behalf of", `${d.company}${d.title ? `, ${d.title}` : ""}`) : null}
              {row("Countersigned by", a.countersignerName ? `${a.countersignerName}, ${a.countersignerTitle}` : "Not yet")}
            </tbody>
          </table>
          <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <tbody>
              {row("Started", formatDate(a.startedAt))}
              {row("Phone verified", formatDate(a.phoneVerifiedAt))}
              {row("Signed", formatDate(a.signedAt))}
              {row("Emailed / texted", `${a.emailedAt ? formatDate(a.emailedAt) : "no"} / ${a.textedAt ? formatDate(a.textedAt) : "no"}`)}
              {row("IP / browser", <span style={{ color: "#6b7280" }}>{a.ip ?? "n/a"} · {a.userAgent ?? "n/a"}</span>)}
              {row("Version / type", `${a.version ?? "n/a"} · ${a.signatureKind ?? "n/a"}`)}
              {row("Document SHA-256", <code style={{ fontSize: "0.72rem" }}>{a.documentSha256 ?? "n/a"}</code>)}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "10px 0 0" }}>
          {data.ndaRequired ? "The recipient has not started the NDA yet. They will see it first when they open their link." : "This code opens the plan without an NDA."}
        </p>
      )}
      {data.history.length > 1 && (
        <p style={{ color: "#6b7280", fontSize: "0.75rem", margin: "10px 0 0" }}>
          History: {data.history.map((h) => `${h.status.toLowerCase()} ${formatDate(h.signedAt ?? h.voidedAt ?? h.createdAt)}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
