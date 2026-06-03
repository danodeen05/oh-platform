"use client";

import { useRef, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_DIM = 400; // logos display small; cap the longest side

/**
 * Read an image file and return a compact data URL. SVGs are kept as-is
 * (vector, scales perfectly); raster images are scaled down to MAX_DIM and
 * exported as PNG (transparency preserved), falling back to JPEG if too large.
 */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const readDataUrl = () =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  if (file.type === "image/svg+xml") return readDataUrl();

  const src = await readDataUrl();
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = src;
  });

  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

  let out = canvas.toDataURL("image/png");
  if (out.length > 400_000) out = canvas.toDataURL("image/jpeg", 0.85);
  return out;
}

export default function LogoUpload({
  eventId,
  currentLogoUrl,
  onSaved,
}: {
  eventId: string;
  currentLogoUrl?: string | null;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = preview || currentLogoUrl || null;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG, etc.).");
      return;
    }
    try {
      setPreview(await fileToLogoDataUrl(file));
    } catch {
      setError("Could not read that image. Try a different file.");
    }
  };

  const save = async (logoUrl: string | null) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onSaved();
    } catch (e) {
      setError("Failed to save logo: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 8 }}>Event / Company Logo</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 10,
            background: "#FBF7F0",
            border: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Logo preview" style={{ maxWidth: "84px", maxHeight: "84px", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>No logo</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onPick(e.target.files?.[0])}
            style={{ fontSize: "0.85rem" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => save(preview)}
              disabled={!preview || busy}
              style={{
                padding: "6px 14px",
                backgroundColor: !preview || busy ? "#c7d2fe" : "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: "0.82rem",
                fontWeight: 500,
                cursor: !preview || busy ? "default" : "pointer",
              }}
            >
              {busy ? "Saving…" : "Save Logo"}
            </button>
            {currentLogoUrl && (
              <button
                onClick={() => save(null)}
                disabled={busy}
                style={{
                  padding: "6px 14px",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>
            PNG, JPG, or SVG. It&apos;s auto-resized and scaled to fit wherever it appears.
          </p>
          {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "#dc2626" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
