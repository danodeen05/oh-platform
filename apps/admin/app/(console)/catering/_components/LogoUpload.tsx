"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { api, ApiError } from "@/lib/api";

const MAX_DIM = 400; // logos display small; cap the longest side

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

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

export function LogoUpload({ eventId, currentLogoUrl, onSaved }: {
  eventId: string; currentLogoUrl?: string | null; onSaved: () => void;
}) {
  const ask = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = preview || currentLogoUrl || null;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG, and so on).");
      return;
    }
    try {
      setPreview(await fileToLogoDataUrl(file));
    } catch {
      setError("Could not read that image. Try a different file.");
    }
  }

  async function save(logoUrl: string | null) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/catering/events/${eventId}`, { method: "PATCH", body: { logoUrl } });
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onSaved();
    } catch (e) {
      setError(`Failed to save logo. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await ask({ title: "Remove the logo?", confirmLabel: "Remove", tone: "danger" });
    if (ok) save(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-oh-stone/15 bg-oh-paper">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Logo preview" className="max-h-20 max-w-20 object-contain" />
        ) : (
          <span className="text-xs text-oh-stone/50">No logo</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" onChange={(e) => onPick(e.target.files?.[0])} className="text-sm text-oh-stone" />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={!preview} loading={busy} onClick={() => save(preview)}>Save logo</Button>
          {currentLogoUrl && <Button size="sm" variant="danger" disabled={busy} onClick={remove}>Remove</Button>}
        </div>
        <p className="text-xs text-oh-stone/60">PNG, JPG, or SVG. It is auto-resized and scaled to fit wherever it appears.</p>
        {error && <p className="text-xs text-oh-ember-deep">{error}</p>}
      </div>
    </div>
  );
}
