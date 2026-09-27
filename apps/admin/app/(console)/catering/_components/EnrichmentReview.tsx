"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { enrichmentFormValues, type EnrichmentSuggestion } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function EnrichmentReview({ eventId, onPublished }: { eventId: string; onPublished?: () => void }) {
  const { show } = useToast();
  const [seededStatus, setSeededStatus] = useState<string | null>(null);
  // Poll every 3s only while enriching; stop once we land on a settled status.
  const res = useResource(`catering-enrichment:${eventId}`, (signal) => api<EnrichmentSuggestion>(`/admin/catering/events/${eventId}/enrichment`, { signal }),
    { refreshMs: seededStatus === "ENRICHING" ? 3000 : undefined });
  const enrichment = res.data;

  const [eventName, setEventName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [companyDescription, setCompanyDescription] = useState("");
  const [saving, setSaving] = useState(false);

  if (enrichment && seededStatus !== enrichment.status) {
    setSeededStatus(enrichment.status);
    const seed = enrichmentFormValues(enrichment);
    setEventName(seed.eventName);
    setLogoUrl(seed.logoUrl);
    setBrandColors(seed.brandColors);
    setCompanyDescription(seed.companyDescription);
  }

  const addColor = () => setBrandColors((c) => [...c, "#000000"]);
  const removeColor = (idx: number) => setBrandColors((c) => c.filter((_, i) => i !== idx));
  const changeColor = (idx: number, value: string) => setBrandColors((c) => c.map((v, i) => (i === idx ? value : v)));

  async function publish() {
    setSaving(true);
    try {
      await api(`/admin/catering/events/${eventId}/enrichment`, {
        method: "PATCH",
        body: { eventName: eventName || undefined, logoUrl: logoUrl || undefined, brandColors: brandColors.filter(Boolean), companyDescription: companyDescription || undefined },
      });
      res.reload();
      onPublished?.();
      show({ message: "Enrichment published. Event is live.", tone: "good" });
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  if (!enrichment) return <Skeleton className="h-24" />;

  if (enrichment.status === "ENRICHING") {
    return (
      <div className="rounded-xl border border-oh-gold/40 bg-oh-gold/10 p-4 text-center">
        <p className="font-display text-[1.25rem] text-oh-clay">AI enrichment in progress</p>
        <p className="mt-1 text-sm text-oh-stone/70">Analyzing the website and generating suggestions. This usually takes 15 to 30 seconds.</p>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-oh-clay">
          <span className="h-2 w-2 rounded-full bg-oh-gold motion-safe:animate-pulse" />
          Refreshing automatically
        </p>
      </div>
    );
  }

  if (enrichment.status === "LIVE") {
    return <div className="rounded-xl border border-oh-olive/30 bg-oh-olive/10 p-4 text-[15px] text-oh-olive">Enrichment accepted and published. Event is live.</div>;
  }

  const suggestionError = enrichment.enrichmentRaw?.error;

  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-display text-[1.25rem] text-oh-charcoal">AI suggestions</h4>
        <p className="text-sm text-oh-stone/70">Review the AI-generated content below. Edit anything that needs adjustment, then save and publish to go live.</p>
        {suggestionError && <p className="mt-2 text-sm text-oh-ember-deep">Automatic enrichment did not find suggestions ({suggestionError}). Fill the fields in yourself, then publish.</p>}
      </div>

      <Field label="Logo URL">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Company logo preview" className="mb-2 h-15 max-w-50 rounded-lg border border-oh-stone/15 bg-oh-paper object-contain p-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <TextInput value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
      </Field>

      <div>
        <p className="mb-2 text-sm font-semibold text-oh-charcoal">Brand colors</p>
        <div className="flex flex-wrap items-center gap-2">
          {brandColors.map((color, idx) => (
            <span key={idx} className="flex items-center gap-1.5 rounded-xl border border-oh-stone/20 bg-oh-cream p-1">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000"} onChange={(e) => changeColor(idx, e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-lg border border-oh-stone/20" aria-label={`Brand color ${idx + 1}`} />
              <span className="w-20 font-mono text-sm text-oh-stone">{color}</span>
              <button type="button" onClick={() => removeColor(idx)} aria-label={`Remove color ${idx + 1}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-oh-ember-deep hover:bg-oh-ember/10">x</button>
            </span>
          ))}
          <Button size="sm" icon="plus" onClick={addColor}>Add color</Button>
        </div>
      </div>

      <Field label="Event name" hint="Shown to attendees">
        <TextInput value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g., Acme Corp Team Lunch 2026" />
      </Field>

      <Field label="Company description">
        <TextArea rows={4} value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)} placeholder="Brief description shown on the attendee landing page" />
      </Field>

      <Button variant="primary" onClick={publish} loading={saving}>Save and publish</Button>
    </div>
  );
}
