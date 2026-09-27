"use client";

/**
 * Adopt a signature by typing it (rendered in a script face) or drawing it.
 * Either way the parent receives a trimmed, transparent PNG data URL, so the
 * online preview, the stored record and the PDF all use the same image.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SignatureKind = "typed" | "drawn";

export interface SignatureValue {
  kind: SignatureKind;
  image: string;
}

interface Props {
  legalName: string;
  fontFamily: string;
  onChange: (value: SignatureValue | null) => void;
}

const INK = "#1C1B19";
const MAX_WIDTH = 900;

/** Draw the typed name onto a canvas in the script face and return a PNG. */
async function typedSignaturePng(text: string, fontFamily: string): Promise<string | null> {
  const name = text.trim();
  if (!name) return null;
  const size = 88;
  const font = `${size}px ${fontFamily}`;
  try {
    await document.fonts.load(font, name);
  } catch {
    // Fall back to whatever the browser has; the preview shows the same.
  }
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = font;
  const width = Math.min(MAX_WIDTH * 2, Math.ceil(measure.measureText(name).width) + 48);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(size * 1.6);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(name, 24, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

export function SignaturePad({ legalName, fontFamily, onChange }: Props) {
  const [kind, setKind] = useState<SignatureKind>("typed");
  const [typed, setTyped] = useState(legalName);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const strokes = useRef(0);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => setTyped(legalName), [legalName]);

  // Typed: re-render the PNG whenever the text changes.
  useEffect(() => {
    if (kind !== "typed") return;
    let live = true;
    void typedSignaturePng(typed, fontFamily).then((image) => {
      if (live) onChange(image ? { kind: "typed", image } : null);
    });
    return () => {
      live = false;
    };
  }, [kind, typed, fontFamily, onChange]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    bounds.current = null;
    strokes.current = 0;
    setHasInk(false);
  }, []);

  useEffect(() => {
    if (kind === "drawn") {
      setupCanvas();
      onChange(null);
    }
  }, [kind, setupCanvas, onChange]);

  const exportDrawn = useCallback(() => {
    const canvas = canvasRef.current;
    const b = bounds.current;
    if (!canvas || !b || strokes.current < 2) {
      onChange(null);
      return;
    }
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    const pad = 10;
    const sx = Math.max(0, (b.minX - pad) * ratio);
    const sy = Math.max(0, (b.minY - pad) * ratio);
    const sw = Math.min(canvas.width - sx, (b.maxX - b.minX + pad * 2) * ratio);
    const sh = Math.min(canvas.height - sy, (b.maxY - b.minY + pad * 2) * ratio);
    const scale = Math.min(1, MAX_WIDTH / sw);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onChange({ kind: "drawn", image: out.toDataURL("image/png") });
  }, [onChange]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function grow(p: { x: number; y: number }): void {
    const b = bounds.current;
    bounds.current = b
      ? { minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }
      : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    grow(p);
    const ctx = e.currentTarget.getContext("2d");
    ctx?.beginPath();
    ctx?.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx?.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p);
    strokes.current += 1;
    if (!hasInk && strokes.current > 1) setHasInk(true);
  }

  function up(): void {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    exportDrawn();
  }

  const tab = (k: SignatureKind, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={kind === k}
      onClick={() => setKind(k)}
      className={`rounded-full px-4 py-1.5 text-[0.8rem] tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember ${
        kind === k ? "bg-oh-charcoal text-oh-cream" : "bg-transparent text-oh-stone hover:text-oh-charcoal"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" aria-label="Signature style" className="mb-3 inline-flex gap-1 rounded-full border border-[#E4D9C3] bg-oh-cream p-1">
        {tab("typed", "Type")}
        {tab("drawn", "Draw")}
      </div>

      {kind === "typed" ? (
        <div>
          <label htmlFor="nda-typed-signature" className="mb-1 block text-[0.72rem] uppercase tracking-[0.12em] text-oh-ash">
            Type your full legal name
          </label>
          <input
            id="nda-typed-signature"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="name"
            className="w-full rounded-md border border-[#E4D9C3] bg-white px-3 py-2 text-base text-oh-charcoal focus:border-oh-ember focus:bg-white focus:text-oh-charcoal focus:outline-none"
          />
          <div className="mt-3 flex h-24 items-end border-b-2 border-oh-ember bg-white/60 px-3 pb-1">
            <span style={{ fontFamily, fontSize: `clamp(1.4rem, ${Math.max(1.4, Math.min(2.6, 42 / Math.max(10, typed.length)))}rem, 2.6rem)` }} className="whitespace-nowrap leading-none text-oh-charcoal">
              {typed || " "}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              aria-label="Draw your signature"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
              className="block h-36 w-full touch-none rounded-md border border-[#E4D9C3] bg-white"
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-8 border-b-2 border-oh-ember/70" />
            {!hasInk ? <span className="pointer-events-none absolute left-4 top-3 text-[0.8rem] text-oh-ash">Sign here with your finger or mouse</span> : null}
          </div>
          <button type="button" onClick={() => { setupCanvas(); onChange(null); }} className="mt-2 bg-transparent text-[0.8rem] text-oh-ember-deep underline underline-offset-4 hover:text-oh-ember">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
