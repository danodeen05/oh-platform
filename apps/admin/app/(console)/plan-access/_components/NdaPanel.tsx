"use client";

/** NDA status, signer details, audit trail and actions for one plan code. */

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { Toggle } from "@/components/ui/Field";
import { SkeletonList } from "@/components/ui/Skeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/plan-access";
import { addressLine, downloadNdaPdf, type NdaAdminDetail } from "@/lib/plan-nda";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-oh-stone/10 py-1.5 text-[15px] last:border-0">
      <span className="shrink-0 text-oh-stone/70">{label}</span>
      <span className={`text-right text-oh-charcoal ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

export function NdaPanel({ codeId }: { codeId: string }) {
  const ask = useConfirm();
  const res = useResource(`plan-nda:${codeId}`, (signal) => api<NdaAdminDetail>(`/admin/plan/codes/${codeId}/nda`, { signal }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (res.error && !res.data) return <ErrorCard message="Couldn't load the NDA." onRetry={res.reload} />;
  if (!res.data) return <SkeletonList rows={2} />;

  const data = res.data;
  const cur = data.current;
  const d = cur?.details;
  const a = cur?.audit;
  const tone: BadgeTone = cur?.status === "SIGNED" ? "good" : data.ndaRequired ? "pending" : "neutral";
  const statusText = cur?.status === "SIGNED" ? `Signed ${formatDate(a?.signedAt ?? null)}` : data.ndaRequired ? (d ? "In progress" : "Awaiting signature") : "Not required";

  async function act(successNote: string, fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote(successNote);
      res.reload();
    } catch (e) {
      setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const download = () => act("Downloaded.", () => downloadNdaPdf(cur!.id));
  const resend = () => act("Copy resent by email and text.", () => api(`/admin/plan/ndas/${cur!.id}/resend`, { method: "POST", body: {} }));

  async function voidNda() {
    const ok = await ask({ title: "Void this NDA?", body: "If the code still requires an NDA, the recipient must sign again before seeing the plan.", confirmLabel: "Void", tone: "danger" });
    if (!ok) return;
    await act("Voided.", () => api(`/admin/plan/ndas/${cur!.id}/void`, { method: "POST", body: {} }));
  }

  function toggleRequired(required: boolean) {
    void act(required ? "NDA now required." : "NDA no longer required.", () => api(`/admin/plan/codes/${codeId}/nda`, { method: "PATCH", body: { required } }));
  }

  return (
    <Card
      title={<span className="flex flex-wrap items-center gap-2">NDA <Badge tone={tone}>{statusText}</Badge></span>}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {cur?.status === "SIGNED" && (
            <>
              <Button size="sm" disabled={busy} onClick={download}>Download PDF</Button>
              <Button size="sm" disabled={busy} onClick={resend}>Resend</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={voidNda}>Void</Button>
            </>
          )}
          <Toggle checked={data.ndaRequired} disabled={busy} onChange={toggleRequired} label="Require NDA" />
        </div>
      }>
      {note && <p className="mb-3 text-sm text-oh-stone">{note}</p>}
      {a?.deliveryError && <p className="mb-3 text-sm font-medium text-oh-ember-deep">Delivery problem: {a.deliveryError}</p>}
      {d && a ? (
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Row label="Legal name" value={d.legalName} />
            <Row label="Email" value={d.email} />
            <Row label="Mobile" value={`${d.phone}${a.phoneVerifiedAt ? " (verified)" : " (not verified)"}`} />
            <Row label="Address" value={addressLine(d.address)} />
            {d.company && <Row label="On behalf of" value={`${d.company}${d.title ? `, ${d.title}` : ""}`} />}
            <Row label="Countersigned by" value={a.countersignerName ? `${a.countersignerName}, ${a.countersignerTitle}` : "Not yet"} />
          </div>
          <div>
            <Row label="Started" value={formatDate(a.startedAt)} />
            <Row label="Phone verified" value={formatDate(a.phoneVerifiedAt)} />
            <Row label="Signed" value={formatDate(a.signedAt)} />
            <Row label="Emailed / texted" value={`${a.emailedAt ? formatDate(a.emailedAt) : "no"} / ${a.textedAt ? formatDate(a.textedAt) : "no"}`} />
            <Row label="IP / browser" value={`${a.ip ?? "n/a"} · ${a.userAgent ?? "n/a"}`} />
            <Row label="Version / type" value={`${a.version ?? "n/a"} · ${a.signatureKind ?? "n/a"}`} />
            <Row label="Document SHA-256" value={a.documentSha256 ?? "n/a"} mono />
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-oh-stone/70">
          {data.ndaRequired ? "The recipient hasn't started the NDA yet. They will see it first when they open their link." : "This code opens the plan without an NDA."}
        </p>
      )}
      {data.history.length > 1 && (
        <p className="mt-3 text-sm text-oh-stone/60">
          History: {data.history.map((h) => `${h.status.toLowerCase()} ${formatDate(h.signedAt ?? h.voidedAt ?? h.createdAt)}`).join(" · ")}
        </p>
      )}
    </Card>
  );
}
