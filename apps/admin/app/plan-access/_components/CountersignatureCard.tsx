"use client";

/**
 * The owner's adopted NDA countersignature. Applied automatically to every
 * plan NDA at the moment the recipient signs, so the PDF is fully executed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "./planAccess";
import { fetchCountersigner, type Countersigner } from "./nda";
import { SignatureCapture } from "./SignatureCapture";

export function CountersignatureCard({ onLoaded }: { onLoaded?: (cs: Countersigner | null) => void }) {
  const [cs, setCs] = useState<Countersigner | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Founder and CEO");
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const load = useCallback(async () => {
    try {
      const c = await fetchCountersigner();
      setCs(c);
      onLoadedRef.current?.(c);
      if (c) { setName(c.name); setTitle(c.title); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onSig = useCallback((p: string | null) => setPng(p), []);

  async function save() {
    if (!png) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/plan/nda/countersigner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, signature: png }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" };

  return (
    <section style={{ background: cs ? "white" : "#fffbeb", border: `1px solid ${cs ? "#e5e7eb" : "#fcd34d"}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>NDA countersignature</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem", maxWidth: 620 }}>
            {cs
              ? "Applied automatically when a recipient signs, so every NDA is fully executed on the spot."
              : "Not adopted yet. Codes that require an NDA cannot be signed until you adopt your countersignature here."}
            {" "}The NDA text should be reviewed by a Utah attorney before you rely on it.
          </p>
        </div>
        {cs && !editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cs.signature} alt="Adopted signature" style={{ maxHeight: 44, maxWidth: 180, objectFit: "contain" }} />
            <div style={{ fontSize: "0.85rem" }}>
              <div style={{ fontWeight: 600 }}>{cs.name}</div>
              <div style={{ color: "#6b7280" }}>{cs.title}</div>
            </div>
            <button onClick={() => setEditing(true)} style={{ padding: "6px 10px", border: "1px solid #d1d5db", background: "white", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}>Change</button>
          </div>
        ) : !editing ? (
          <button onClick={() => setEditing(true)} style={{ padding: "8px 14px", background: "#5A5847", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>Adopt signature</button>
        ) : null}
      </div>
      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 16, marginTop: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Full legal name</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, margin: "10px 0 4px" }}>Title</label>
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
            <p style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: 10 }}>Signing as Oh! Beef Noodle Soup, LLC.</p>
          </div>
          <div>
            <SignatureCapture defaultName={name} onChange={onSig} />
            {error && <p style={{ color: "#991b1b", fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button onClick={() => setEditing(false)} style={{ padding: "8px 14px", background: "white", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => void save()} disabled={saving || !png || name.trim().length < 3 || !title.trim()} style={{ padding: "8px 14px", background: "#5A5847", color: "white", border: "none", borderRadius: 6, cursor: "pointer", opacity: saving || !png ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Adopt signature"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
