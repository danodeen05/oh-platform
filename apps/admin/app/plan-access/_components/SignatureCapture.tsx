"use client";

/** Draw or type a signature; returns a trimmed transparent PNG data URL (same format the plan NDA stores). */

import { useCallback, useEffect, useRef, useState } from "react";
import { Allura } from "next/font/google";

const script = Allura({ weight: "400", subsets: ["latin"], display: "swap" });
const INK = "#1C1B19";

async function typedPng(text: string): Promise<string | null> {
  const name = text.trim();
  if (!name) return null;
  const font = `88px ${script.style.fontFamily}`;
  try { await document.fonts.load(font, name); } catch { /* fall back */ }
  const m = document.createElement("canvas").getContext("2d");
  if (!m) return null;
  m.font = font;
  const c = document.createElement("canvas");
  c.width = Math.min(1800, Math.ceil(m.measureText(name).width) + 48);
  c.height = 140;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(name, 24, 70);
  return c.toDataURL("image/png");
}

export function SignatureCapture({ defaultName, onChange }: { defaultName: string; onChange: (png: string | null) => void }) {
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [text, setText] = useState(defaultName);
  const ref = useRef<HTMLCanvasElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<{ a: number; b: number; c: number; d: number } | null>(null);

  useEffect(() => { setText(defaultName); }, [defaultName]);
  useEffect(() => {
    if (mode !== "typed") return;
    let live = true;
    void typedPng(text).then((png) => { if (live) onChange(png); });
    return () => { live = false; };
  }, [mode, text, onChange]);

  const reset = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const k = window.devicePixelRatio || 1;
    c.width = r.width * k;
    c.height = r.height * k;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    box.current = null;
    onChange(null);
  }, [onChange]);

  useEffect(() => { if (mode === "drawn") reset(); }, [mode, reset]);

  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const b = box.current;
    box.current = b ? { a: Math.min(b.a, p.x), b: Math.min(b.b, p.y), c: Math.max(b.c, p.x), d: Math.max(b.d, p.y) } : { a: p.x, b: p.y, c: p.x, d: p.y };
    return p;
  };
  const finish = () => {
    last.current = null;
    const c = ref.current;
    const b = box.current;
    if (!c || !b) return;
    const k = c.width / c.getBoundingClientRect().width;
    const sx = Math.max(0, (b.a - 10) * k), sy = Math.max(0, (b.b - 10) * k);
    const sw = Math.min(c.width - sx, (b.c - b.a + 20) * k), sh = Math.min(c.height - sy, (b.d - b.b + 20) * k);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    out.getContext("2d")?.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onChange(out.toDataURL("image/png"));
  };

  const tab = (m: "typed" | "drawn", label: string) => (
    <button type="button" onClick={() => setMode(m)} style={{ padding: "4px 12px", borderRadius: 999, border: "1px solid #d1d5db", background: mode === m ? "#1C1B19" : "white", color: mode === m ? "white" : "#374151", cursor: "pointer", fontSize: "0.8rem" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{tab("typed", "Type")}{tab("drawn", "Draw")}</div>
      {mode === "typed" ? (
        <div>
          <input value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }} />
          <div style={{ marginTop: 8, height: 70, borderBottom: "2px solid #C1502E", display: "flex", alignItems: "flex-end", padding: "0 8px 2px", background: "#FAF7F1" }}>
            <span className={script.className} style={{ fontSize: "2.6rem", lineHeight: 1, color: INK }}>{text || " "}</span>
          </div>
        </div>
      ) : (
        <div>
          <canvas
            ref={ref}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = pt(e); }}
            onPointerMove={(e) => {
              if (!last.current) return;
              const ctx = e.currentTarget.getContext("2d");
              const p = pt(e);
              ctx?.beginPath(); ctx?.moveTo(last.current.x, last.current.y); ctx?.lineTo(p.x, p.y); ctx?.stroke();
              last.current = p;
            }}
            onPointerUp={finish}
            onPointerLeave={() => { if (last.current) finish(); }}
            style={{ width: "100%", height: 130, border: "1px solid #d1d5db", borderRadius: 6, background: "#FAF7F1", touchAction: "none", display: "block" }}
          />
          <button type="button" onClick={reset} style={{ marginTop: 6, background: "none", border: "none", color: "#A94422", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>Clear</button>
        </div>
      )}
    </div>
  );
}
