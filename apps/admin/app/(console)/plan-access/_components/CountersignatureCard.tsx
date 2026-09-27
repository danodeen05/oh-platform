"use client";

/**
 * The owner's adopted NDA countersignature. Applied automatically to every
 * plan NDA at the moment the recipient signs, so the PDF is fully executed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/api";
import { fetchCountersigner, type Countersigner } from "@/lib/plan-nda";
import { SignatureCapture } from "./SignatureCapture";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

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
      setError(errorText(err));
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
      await api("/admin/plan/nda/countersigner", { method: "PUT", body: { name, title, signature: png } });
      setEditing(false);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card title="NDA countersignature"
      action={cs && !editing ? <Button size="sm" onClick={() => setEditing(true)}>Change</Button> : !editing ? <Button variant="primary" size="sm" onClick={() => setEditing(true)}>Adopt signature</Button> : null}>
      <p className="text-[15px] leading-relaxed text-oh-stone/80">
        {cs
          ? "Applied automatically when a recipient signs, so every NDA is fully executed on the spot."
          : "Not adopted yet. Codes that require an NDA cannot be signed until you adopt your countersignature here."}
        {" "}The NDA text should be reviewed by a Utah attorney before you rely on it.
      </p>

      {cs && !editing && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cs.signature} alt="Adopted signature" className="max-h-11 max-w-[180px] object-contain" />
          <div className="text-[15px]">
            <p className="font-semibold text-oh-charcoal">{cs.name}</p>
            <p className="text-oh-stone/70">{cs.title}</p>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Full legal name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <p className="text-sm text-oh-stone/70">Signing as Oh! Beef Noodle Soup, LLC.</p>
          </div>
          <div>
            <SignatureCapture defaultName={name} onChange={onSig} />
            {error && <p role="alert" className="mt-2 text-sm font-medium text-oh-ember-deep">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" onClick={save} loading={saving} disabled={saving || !png || name.trim().length < 3 || !title.trim()}>Adopt signature</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
