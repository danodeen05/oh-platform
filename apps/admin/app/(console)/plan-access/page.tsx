"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CountersignatureCard } from "./_components/CountersignatureCard";
import { IssueCodeSheet } from "./_components/IssueCodeSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { canCopyLink, formatDate, formatMinutes, ndaBadge, sessionsSummary, statusTone, type CodeRow } from "@/lib/plan-access";
import { planInviteUrl } from "@/lib/urls";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

/** Copies the invite link; falls back to selecting the text in a read-only input if the clipboard API fails. */
function CopyLink({ code }: { code: CodeRow }) {
  const [state, setState] = useState<"idle" | "copied" | "fallback">("idle");
  // A stable ref (empty deps) so this only fires once, when the input mounts -
  // an inline arrow function would get a new identity, and React would re-run
  // it (re-selecting the text) on every render, fighting the user's own clicks.
  const selectOnMount = useCallback((el: HTMLInputElement | null) => el?.select(), []);
  if (!canCopyLink(code)) return null;
  const url = planInviteUrl(code.code);
  if (state === "fallback") {
    return (
      <input readOnly value={url} aria-label={`Invite link for ${code.label}`}
        ref={selectOnMount} onBlur={() => setState("idle")}
        className="min-h-11 w-full max-w-[220px] rounded-lg border border-oh-stone/25 bg-oh-paper px-2 text-sm text-oh-charcoal" />
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 1500);
    } catch {
      setState("fallback");
    }
  }
  return <Button size="sm" onClick={copy}>{state === "copied" ? "Copied" : "Copy link"}</Button>;
}

export default function PlanAccessPage() {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource("plan-codes", (signal) => api<{ codes: CodeRow[] }>("/admin/plan/codes", { signal }));
  const codes = res.data?.codes;

  const [issueOpen, setIssueOpen] = useState(false);
  const [justIssued, setJustIssued] = useState<CodeRow | null>(null);

  async function revoke(code: CodeRow) {
    const ok = await ask({ title: `Revoke access for "${code.label}"?`, body: "Their link stops working immediately.", confirmLabel: "Revoke", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/admin/plan/codes/${code.id}/revoke`, { method: "PATCH" });
      res.reload();
      show({ message: `${code.label} revoked.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  const COLUMNS: Column<CodeRow>[] = [
    { key: "label", label: "Label", render: (c) => (
      <>
        <Link href={`/plan-access/${c.id}`} className="font-semibold text-oh-charcoal underline-offset-4 hover:underline">{c.label}</Link>
        <span className="block font-mono text-sm text-oh-stone/60">{c.code}</span>
      </>
    ) },
    { key: "audience", label: "Audience", render: (c) => `${c.audience} / ${c.defaultScenario}` },
    { key: "created", label: "Created", render: (c) => formatDate(c.createdAt) },
    { key: "viewed", label: "Last viewed", render: (c) => formatDate(c.lastViewedAt) },
    { key: "sessions", label: "Sessions", render: (c) => <span className="tabular-nums">{sessionsSummary(c)}</span> },
    { key: "time", label: "Time", render: (c) => <span className="tabular-nums">{formatMinutes(c.totalSeconds)}</span> },
    { key: "questions", label: "Questions", render: (c) => <span className="tabular-nums">{c.questionCount}</span> },
    { key: "nda", label: "NDA", render: (c) => { const n = ndaBadge(c); return <Badge tone={n.tone}>{n.label}</Badge>; } },
    { key: "status", label: "Status", render: (c) => <Badge tone={statusTone(c.status)}>{c.status}</Badge> },
    { key: "actions", label: "Actions", render: (c) => (
      <span className="flex flex-wrap items-center gap-2">
        <CopyLink code={c} />
        {c.status === "ACTIVE" && <Button size="sm" variant="danger" onClick={() => revoke(c)}>Revoke</Button>}
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Plan access"
        subtitle="Per-recipient codes for the interactive business plan, with view analytics."
        actions={<Button variant="primary" icon="plus" onClick={() => setIssueOpen(true)}>Issue code</Button>} />

      <div className="space-y-5">
        {justIssued && (
          <Card title={`Code issued for ${justIssued.label}`}>
            <p className="font-mono text-[1.1rem] tracking-[0.08em] text-oh-charcoal">{justIssued.code}</p>
            <p className="mt-1.5 text-sm text-oh-stone/70">{justIssued.ndaRequired ? "NDA required: they sign it before seeing the plan." : "No NDA: the link opens the plan directly."}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-oh-linen px-3 py-2 text-sm text-oh-charcoal">{planInviteUrl(justIssued.code)}</code>
              <CopyLink code={justIssued} />
            </div>
          </Card>
        )}

        <CountersignatureCard />

        {res.error && !codes ? (
          <ErrorCard message="Couldn't load plan access codes." onRetry={res.reload} />
        ) : !codes ? (
          <SkeletonList rows={4} />
        ) : (
          <DataList rows={codes} rowKey={(c) => c.id} columns={COLUMNS}
            empty={<EmptyState icon="key" title="No codes yet" body="Issue the first one." action={<Button variant="primary" icon="plus" onClick={() => setIssueOpen(true)}>Issue code</Button>} />}
            renderCard={(c) => {
              const n = ndaBadge(c);
              return (
                <div className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <Link href={`/plan-access/${c.id}`} className="flex min-h-11 min-w-11 items-center font-semibold text-oh-charcoal underline-offset-4 hover:underline">{c.label}</Link>
                      <span className="block font-mono text-sm text-oh-stone/60">{c.code}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      <Badge tone={n.tone}>{n.label}</Badge>
                    </span>
                  </div>
                  <p className="text-sm text-oh-stone/70">{c.audience} / {c.defaultScenario} - created {formatDate(c.createdAt)}</p>
                  <p className="flex flex-wrap gap-x-3 text-sm tabular-nums text-oh-stone/70">
                    <span>{sessionsSummary(c)} sessions</span>
                    <span>{formatMinutes(c.totalSeconds)}</span>
                    <span>{c.questionCount} questions</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <CopyLink code={c} />
                    {c.status === "ACTIVE" && <Button size="sm" variant="danger" onClick={() => revoke(c)}>Revoke</Button>}
                  </div>
                </div>
              );
            }} />
        )}
      </div>

      {issueOpen && (
        <IssueCodeSheet open onClose={() => setIssueOpen(false)}
          onCreated={(code) => { setIssueOpen(false); setJustIssued(code); res.reload(); }} />
      )}
    </>
  );
}
