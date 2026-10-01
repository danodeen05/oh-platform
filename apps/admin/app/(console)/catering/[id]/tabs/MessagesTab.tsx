"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formatPhone, MESSAGE_KINDS, type GuestMessages, type MessageKind, type SendResult } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

const KIND_INFO: Record<MessageKind, { label: string; help: string }> = {
  invite: { label: "Invite", help: "Invite: the personal link to pick a bowl." },
  reminder: { label: "Day-of reminder", help: "Day-of reminder: a friendly nudge with the arrival link." },
  status: { label: "Status link", help: "Status link: where they can follow their bowl. Guests need an order first." },
};
const OPTIONS: SegmentOption<MessageKind>[] = MESSAGE_KINDS.map((k) => ({ value: k, label: KIND_INFO[k].label }));

export default function MessagesTab({ eventId }: { eventId: string }) {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`catering-messages:${eventId}`, (signal) => api<GuestMessages>(`/admin/catering/events/${eventId}/messages`, { signal }));
  const [kind, setKind] = useState<MessageKind>("invite");
  const [busy, setBusy] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  if (res.error && !res.data) return <ErrorCard message="Couldn't load the messages." onRetry={res.reload} />;
  if (!res.data) return <SkeletonList rows={3} />;
  const guests = res.data.guests;

  if (guests.length === 0) {
    return <div className="rounded-card border border-oh-stone/15 bg-oh-cream shadow-card"><EmptyState icon="users" title="No guests yet" body="Add your guests on the Guests tab, then come back to text them." /></div>;
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      show({ message: "Copied", tone: "good" });
    } catch {
      show({ message: "Couldn't copy the text.", tone: "alert" });
    }
  }

  async function send(rsvpIds: string[] | undefined, title: string, confirmLabel: string, busyKey: string) {
    const ok = await ask({ title, confirmLabel });
    if (!ok) return;
    setBusy(busyKey);
    try {
      const data = await api<SendResult>(`/admin/catering/events/${eventId}/messages/send`, { method: "POST", body: rsvpIds ? { kind, rsvpIds } : { kind } });
      const names = new Map(guests.map((g) => [g.rsvpId, g.name]));
      const failed = data.results.filter((r) => !r.ok && !r.skipped).map((r) => names.get(r.rsvpId) || "Guest");
      const skippedNames = data.results.filter((r) => r.skipped).map((r) => names.get(r.rsvpId) || "Guest");
      setFailures(failed);
      setSkipped(skippedNames);
      show({ message: `Sent ${data.sent} of ${data.total}. ${data.failed} failed.${data.skipped > 0 ? ` ${data.skipped} skipped (no order yet).` : ""}`, tone: data.failed ? "alert" : "good" });
    } catch (e) {
      show({ message: `Couldn't send. ${errorText(e)}`, tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  const sendable = guests.filter((g) => g.messages[kind] !== null).length;

  return (
    <div className="space-y-4">
      <SegmentedControl<MessageKind> label="Message type" value={kind} onChange={(k) => { setKind(k); setFailures([]); setSkipped([]); }} options={OPTIONS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-56 text-[15px] text-oh-stone/70">{KIND_INFO[kind].help}</p>
        <Button variant="primary" icon="phone" disabled={sendable === 0} loading={busy === "all"}
          onClick={() => send(undefined, `Text ${sendable} ${sendable === 1 ? "guest" : "guests"} now?`, "Send to everyone", "all")}>Send to everyone</Button>
      </div>
      {failures.length > 0 && (
        <p role="alert" className="rounded-xl bg-oh-ember/10 px-4 py-3 text-sm text-oh-ember-deep">Didn&apos;t reach: {failures.join(", ")}</p>
      )}

      {skipped.length > 0 && (
        <p className="rounded-xl bg-oh-linen px-4 py-3 text-sm text-oh-stone">Skipped (no order yet): {skipped.join(", ")}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {guests.map((g) => {
          const text = g.messages[kind];
          return (
            <Card key={g.rsvpId}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-oh-charcoal">{g.name}</span>
                  <span className="block text-sm tabular-nums text-oh-stone/70">{formatPhone(g.phone)}</span>
                </span>
                {text === null && <Badge tone="neutral">No order yet</Badge>}
              </div>
              {text !== null && <p className="whitespace-pre-wrap rounded-xl bg-oh-linen/60 p-3 text-sm text-oh-charcoal">{text}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon="copy" disabled={text === null} onClick={() => text !== null && copy(text)}>Copy</Button>
                <Button size="sm" icon="phone" disabled={text === null} loading={busy === g.rsvpId}
                  onClick={() => send([g.rsvpId], `Text ${g.name} now?`, "Send", g.rsvpId)}>Send</Button>
              </div>
            </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
