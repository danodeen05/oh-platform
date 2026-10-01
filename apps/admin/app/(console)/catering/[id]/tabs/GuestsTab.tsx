"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { dobToInput, formatBirthday, formatPhone, inputToDob, type Rsvp } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

type GuestForm = { name: string; phone: string; dob: string; notes: string };

function GuestSheet({ eventId, guest, onClose, onSaved }: { eventId: string; guest: Rsvp | null; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [form, setForm] = useState<GuestForm>({
    name: guest?.name || "", phone: guest ? formatPhone(guest.phone) : "", dob: dobToInput(guest?.dob), notes: guest?.notes || "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof GuestForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof GuestForm, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  async function save() {
    const errs: Partial<Record<keyof GuestForm, string>> = {};
    if (!form.name.trim()) errs.name = "Enter a name.";
    if (form.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) errs.phone = "Enter a 10 digit phone number.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { name: form.name.trim(), phone: form.phone.trim(), dob: inputToDob(form.dob) || undefined, notes: form.notes.trim() || undefined };
      if (guest) {
        // Clearing the birthday or notes has to be sent explicitly on edit.
        await api(`/admin/catering/events/${eventId}/rsvps/${guest.id}`, { method: "PATCH", body: { ...body, dob: inputToDob(form.dob) || null, notes: form.notes.trim() || null } });
      } else {
        await api(`/admin/catering/events/${eventId}/rsvps`, { method: "POST", body });
      }
      show({ message: guest ? "Guest saved" : "Guest added", tone: "good" });
      onSaved();
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={guest ? "Edit guest" : "Add guest"}
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>{guest ? "Save changes" : "Add guest"}</Button>}>
      <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} autoComplete="off" />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <TextInput type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={Boolean(errors.phone)} placeholder="(801) 555-0100" autoComplete="off" />
        </Field>
        <Field label="Birthday" hint="Optional. Used for their zodiac sign and a birthday hello.">
          <TextInput type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Notes" hint="Optional">
          <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Allergies, plus one, anything to remember" />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default function GuestsTab({ eventId }: { eventId: string }) {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`catering-guests:${eventId}`, async (signal) => {
    const rows = await api<Rsvp[]>(`/admin/catering/events/${eventId}/rsvps`, { signal });
    return Array.isArray(rows) ? rows : [];
  });
  const [editing, setEditing] = useState<Rsvp | "new" | null>(null);

  if (res.error && !res.data) return <ErrorCard message="Couldn't load guests." onRetry={res.reload} />;
  if (!res.data) return <SkeletonList rows={4} />;
  const guests = res.data;

  async function copyLink(g: Rsvp) {
    try {
      if (!g.inviteUrl) throw new Error("No link yet");
      await navigator.clipboard.writeText(g.inviteUrl);
      show({ message: `Link for ${g.name} copied`, tone: "good" });
    } catch {
      show({ message: "Couldn't copy the link.", tone: "alert" });
    }
  }

  async function remove(g: Rsvp) {
    const ok = await ask({ title: `Remove ${g.name}?`, body: "They will no longer be on the guest list.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/admin/catering/events/${eventId}/rsvps/${g.id}`, { method: "DELETE" });
      show({ message: `${g.name} removed`, tone: "good" });
      res.reload();
    } catch (e) {
      show({ message: `Couldn't remove. ${errorText(e)}`, tone: "alert" });
    }
  }

  const status = (g: Rsvp) => <Badge tone={g.ordered ? "good" : "neutral"}>{g.ordered ? "Ordered" : "Not yet"}</Badge>;
  const actions = (g: Rsvp) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" icon="copy" onClick={() => copyLink(g)}>Copy link</Button>
      <Button size="sm" icon="edit" onClick={() => setEditing(g)}>Edit</Button>
      <Button size="sm" variant="danger" icon="trash" onClick={() => remove(g)}>Delete</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-oh-stone/70">{guests.length} {guests.length === 1 ? "guest" : "guests"}</p>
        <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>Add guest</Button>
      </div>

      <DataList rows={guests} rowKey={(g) => g.id}
        empty={<div className="rounded-card border border-oh-stone/15 bg-oh-cream shadow-card"><EmptyState icon="users" title="No guests yet" body="No guests yet. Add the people you are cooking for." /></div>}
        columns={[
          { key: "name", label: "Name", render: (g) => <span className="font-semibold text-oh-charcoal">{g.name}</span> },
          { key: "phone", label: "Phone", render: (g) => <span className="tabular-nums">{formatPhone(g.phone)}</span> },
          { key: "dob", label: "Birthday", render: (g) => formatBirthday(g.dob) || <span className="text-oh-stone/50">Not set</span> },
          { key: "zodiac", label: "Zodiac", render: (g) => g.zodiac || <span className="text-oh-stone/50">-</span> },
          { key: "notes", label: "Notes", render: (g) => <span className="line-clamp-2 max-w-56 text-oh-stone/80">{g.notes || ""}</span> },
          { key: "status", label: "Status", render: status },
          { key: "actions", label: "", align: "right", render: actions },
        ]}
        renderCard={(g) => (
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-oh-charcoal">{g.name}</span>
                <span className="block text-sm tabular-nums text-oh-stone/70">{formatPhone(g.phone)}</span>
              </span>
              {status(g)}
            </div>
            {(g.dob || g.zodiac) && (
              <p className="text-sm text-oh-stone/70">{[g.dob ? formatBirthday(g.dob) : null, g.zodiac].filter(Boolean).join(" · ")}</p>
            )}
            {g.notes && <p className="text-sm text-oh-stone/70">{g.notes}</p>}
            {actions(g)}
          </div>
        )} />

      {editing && (
        <GuestSheet eventId={eventId} guest={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); res.reload(); }} />
      )}
    </div>
  );
}
