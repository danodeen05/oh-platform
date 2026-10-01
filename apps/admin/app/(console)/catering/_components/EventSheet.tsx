"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { dollarsToCents, Field, MoneyInput, NumberInput, Select, TextArea, TextInput, Toggle } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  defaultPriceForSlot, defaultStartTime, emptyEventForm, START_TIMES, EVENT_TYPES, eventBody, formFromEvent, minimumCommitment,
  STATUSES, statusLabel, validateEvent, type CateringEvent, type CateringSlot, type EventForm,
} from "@/lib/catering";

type Props = {
  open: boolean;
  event: CateringEvent | null;
  prefillDate?: string;
  prefillSlot?: CateringSlot;
  onClose: () => void;
  onSaved: (event: CateringEvent, created: boolean) => void;
};

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "address", label: "Address" },
  { id: "logistics", label: "Logistics" },
  { id: "pricing", label: "Pricing" },
  { id: "branding", label: "Branding" },
  { id: "notes", label: "Notes" },
] as const;

const chipCls = (on: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${on
    ? "border-oh-charcoal bg-oh-charcoal text-oh-cream"
    : "border-oh-stone/20 bg-oh-cream text-oh-stone hover:border-oh-stone/40"}`;

/** Create or edit one catering event. Six sections, jump chips at the top (mirrors PromoSheet). */
export function EventSheet({ open, event, prefillDate, prefillSlot, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [form, setForm] = useState<EventForm>(() => (event ? formFromEvent(event) : emptyEventForm(prefillDate, prefillSlot)));
  const [errors, setErrors] = useState<Partial<Record<keyof EventForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function setSlot(slot: CateringSlot) {
    setForm((f) => ({
      ...f, slot, pricePerBowlCents: defaultPriceForSlot(slot),
      // Follow the slot only while the time is still the other slot's default.
      startTime: f.startTime === defaultStartTime(f.slot) ? defaultStartTime(slot) : f.startTime,
    }));
  }

  function setComplimentary(on: boolean) {
    setForm((f) => ({
      ...f, complimentary: on,
      pricePerBowlCents: !on && (dollarsToCents(f.pricePerBowlCents) ?? 0) <= 0 ? defaultPriceForSlot(f.slot) : f.pricePerBowlCents,
    }));
    setErrors((e) => ({ ...e, pricePerBowlCents: undefined }));
  }

  function jumpTo(id: string) {
    bodyRef.current?.querySelector(`#event-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const addColor = () => set("brandColors", [...form.brandColors, "#000000"]);
  const removeColor = (idx: number) => set("brandColors", form.brandColors.filter((_, i) => i !== idx));
  const changeColor = (idx: number, value: string) => set("brandColors", form.brandColors.map((c, i) => (i === idx ? value : c)));

  async function save() {
    const errs = validateEvent(form);
    setErrors(errs);
    if (Object.keys(errs).some((k) => errs[k as keyof EventForm])) return;
    setSaving(true);
    try {
      const body = eventBody(form, Boolean(event));
      const saved = event
        ? await api<CateringEvent>(`/admin/catering/events/${event.id}`, { method: "PATCH", body })
        : await api<CateringEvent>("/admin/catering/events", { method: "POST", body });

      if (!event && form.clientWebsite.trim() && saved.id) {
        // Non-fatal: enrichment runs in the background.
        api(`/admin/catering/events/${saved.id}/enrich`, { method: "POST" }).catch(() => {});
      }
      onSaved(saved, !event);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  const commitment = minimumCommitment(form);
  const lat = form.eventLat.trim();
  const lng = form.eventLng.trim();

  return (
    <Sheet open={open} onClose={onClose} title={event ? "Edit event" : "New event"}
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>{event ? "Save changes" : "Create event"}</Button>}>
      <div className="-mx-4 -mt-5 mb-4 flex gap-2 overflow-x-auto border-b border-oh-stone/15 bg-oh-paper px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => <button key={s.id} type="button" className={chipCls(false)} onClick={() => jumpTo(s.id)}>{s.label}</button>)}
      </div>
      <div ref={bodyRef} className="space-y-8">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <section id="event-details" className="scroll-mt-2 space-y-5">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Details</h3>
            <Field label="Client company" error={errors.clientCompany}>
              <TextInput value={form.clientCompany} onChange={(e) => set("clientCompany", e.target.value)} aria-invalid={Boolean(errors.clientCompany)} placeholder="Acme Corp" />
            </Field>
            <Field label="Client website" hint="Optional">
              <TextInput value={form.clientWebsite} onChange={(e) => set("clientWebsite", e.target.value)} placeholder="https://acme.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name">
                <TextInput value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Jane Smith" />
              </Field>
              <Field label="Contact phone">
                <TextInput value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+1 (555) 000-0000" />
              </Field>
            </div>
            <Field label="Contact email">
              <TextInput type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="jane@acme.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event date" error={errors.eventDate}>
                <input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} aria-invalid={Boolean(errors.eventDate)}
                  className="block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30" />
              </Field>
              <Field label="Slot">
                <SegmentedControl label="Slot" value={form.slot} onChange={setSlot}
                  options={[{ value: "LUNCH" as CateringSlot, label: "Lunch" }, { value: "DINNER" as CateringSlot, label: "Dinner" }]} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time" hint="Denver time">
                <Select value={form.startTime} onChange={(e) => set("startTime", e.target.value)}>
                  {START_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Host name" hint="Who guests will thank">
                <TextInput value={form.hostName} onChange={(e) => set("hostName", e.target.value)} placeholder="Jane" />
              </Field>
            </div>
            <Field label="Welcome note" hint={`Shown on the guest page. ${form.welcomeNote.length}/240`}>
              <TextArea rows={3} maxLength={240} value={form.welcomeNote} onChange={(e) => set("welcomeNote", e.target.value)} placeholder="A short hello for your guests" />
            </Field>
            {event && (
              <Field label="Status" hint="Override only. Booking and payment flows also change this automatically.">
                <Select value={form.status} onChange={(e) => set("status", e.target.value as EventForm["status"])}>
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </Select>
              </Field>
            )}
          </section>

          <section id="event-address" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Address</h3>
            <Field label="Event address" hint="The full address where the event is catered.">
              <TextInput value={form.eventAddress} onChange={(e) => set("eventAddress", e.target.value)} placeholder="123 Main St, Salt Lake City, UT 84101" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" error={errors.eventLat}>
                <TextInput value={form.eventLat} onChange={(e) => set("eventLat", e.target.value)} aria-invalid={Boolean(errors.eventLat)} placeholder="40.7608" />
              </Field>
              <Field label="Longitude" error={errors.eventLng}>
                <TextInput value={form.eventLng} onChange={(e) => set("eventLng", e.target.value)} aria-invalid={Boolean(errors.eventLng)} placeholder="-111.8910" />
              </Field>
            </div>
            <p className="text-sm text-oh-stone/70">Coordinates are captured automatically at booking. Edit them only if the address was corrected and the map pin needs to move.</p>
            {lat && lng && !errors.eventLat && !errors.eventLng && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex text-sm font-semibold text-oh-ember-deep hover:underline">Preview pin on Google Maps</a>
            )}
          </section>

          <section id="event-logistics" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Logistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event type">
                <Select value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
                  <option value="">Not set</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Expected guests" hint="Headcount, separate from bowls booked">
                <NumberInput value={form.expectedGuests} onChange={(e) => set("expectedGuests", e.target.value)} placeholder="e.g. 40" />
              </Field>
            </div>
            <Field label="Dietary needs" hint="Optional">
              <TextArea rows={3} value={form.dietaryNotes} onChange={(e) => set("dietaryNotes", e.target.value)} placeholder="Vegetarian, vegan, gluten-free counts and any allergies" />
            </Field>
            <Field label="Setup and space notes" hint="Optional">
              <TextArea rows={3} value={form.setupNotes} onChange={(e) => set("setupNotes", e.target.value)} placeholder="Indoor or outdoor, tables, power access, parking" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day-of on-site contact">
                <TextInput value={form.onsiteContactName} onChange={(e) => set("onsiteContactName", e.target.value)} placeholder="Name" />
              </Field>
              <Field label="On-site contact phone">
                <TextInput value={form.onsiteContactPhone} onChange={(e) => set("onsiteContactPhone", e.target.value)} placeholder="+1 (555) 000-0000" />
              </Field>
            </div>
          </section>

          <section id="event-pricing" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Pricing</h3>
            <Toggle checked={form.complimentary} onChange={setComplimentary} label="Complimentary (no charge for bowls)" />
            <Field label="Price per bowl" error={errors.pricePerBowlCents}>
              <MoneyInput key={form.complimentary ? "free" : "paid"} disabled={form.complimentary} cents={form.complimentary ? 0 : dollarsToCents(form.pricePerBowlCents)} onCents={() => {}} aria-invalid={Boolean(errors.pricePerBowlCents)}
                onInput={(e) => set("pricePerBowlCents", e.currentTarget.value)} placeholder="0.00" />
            </Field>
            <div className={`grid gap-3 ${event ? "grid-cols-2" : "grid-cols-1"}`}>
              <Field label="Minimum bowls" error={errors.minimumBowls}>
                <NumberInput value={form.minimumBowls} onChange={(e) => set("minimumBowls", e.target.value)} aria-invalid={Boolean(errors.minimumBowls)} />
              </Field>
              {event && (
                <Field label="Bowls booked" hint="Override only. Does not recalculate the existing charge.">
                  <NumberInput value={form.bookedBowls} onChange={(e) => set("bookedBowls", e.target.value)} />
                </Field>
              )}
            </div>
            {commitment && <p className="rounded-xl border border-oh-stone/15 bg-oh-linen/60 p-3 text-[15px] text-oh-charcoal"><strong>Minimum commitment:</strong> {commitment}</p>}
            <p className="text-sm text-oh-stone/70">Default prices: Lunch = $24.99/bowl, Dinner = $29.99/bowl.</p>
          </section>

          <section id="event-branding" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Branding</h3>
            <p className="text-sm text-oh-stone/70">These drive the co-branded attendee page. Brand colors map to the page theme (first color = primary accent, second = secondary, third = background tint).</p>
            <Field label="Event name" hint="Shown to attendees">
              <TextInput value={form.eventName} onChange={(e) => set("eventName", e.target.value)} placeholder="e.g., Oh! x Acme Corp" />
            </Field>
            <Field label="Logo URL" hint="Optional; the Overview tab also supports uploading a logo file">
              <TextInput value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://example.com/logo.png" />
            </Field>
            <div>
              <p className="mb-2 text-sm font-semibold text-oh-charcoal">Brand colors</p>
              <div className="flex flex-wrap items-center gap-2">
                {form.brandColors.map((color, idx) => (
                  <span key={idx} className="flex items-center gap-1.5 rounded-xl border border-oh-stone/20 bg-oh-cream p-1">
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000"} onChange={(e) => changeColor(idx, e.target.value)}
                      className="h-9 w-10 cursor-pointer rounded-lg border border-oh-stone/20" aria-label={`Brand color ${idx + 1}`} />
                    <input value={color} onChange={(e) => changeColor(idx, e.target.value)}
                      className="w-24 rounded-lg border border-oh-stone/20 bg-oh-paper px-2 py-1 font-mono text-sm text-oh-charcoal" />
                    <button type="button" onClick={() => removeColor(idx)} aria-label={`Remove color ${idx + 1}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-oh-ember-deep hover:bg-oh-ember/10">x</button>
                  </span>
                ))}
                <Button size="sm" icon="plus" onClick={addColor}>Add color</Button>
              </div>
            </div>
            <Field label="Company description" hint="Shown on the attendee landing page">
              <TextArea rows={4} value={form.companyDescription} onChange={(e) => set("companyDescription", e.target.value)} />
            </Field>
          </section>

          <section id="event-notes" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Notes</h3>
            <Field label="Internal notes" hint="Dietary restrictions, special setup requirements, internal context">
              <TextArea rows={8} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </div>
    </Sheet>
  );
}
