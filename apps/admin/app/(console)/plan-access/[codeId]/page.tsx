"use client";
import { use, useState } from "react";
import { InvitePanel } from "../_components/InvitePanel";
import { NdaPanel } from "../_components/NdaPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatMinutes, statusTone, type CodeDetail, type HeatRow } from "@/lib/plan-access";
import { planInviteUrl } from "@/lib/urls";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/plan-access", label: "Plan access" };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

function SessionCard({ session }: { session: CodeDetail["sessions"][number] }) {
  const [open, setOpen] = useState(false);
  const summaries = (session.visitSummaries ?? []).filter((v) => v.error !== "skipped_short");
  return (
    <li className="py-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="text-[15px] font-medium text-oh-charcoal">{formatDate(session.startedAt)}</span>
        <span className="text-sm tabular-nums text-oh-stone/70">{formatMinutes(session.totalSeconds)}{session.country ? ` · ${session.country}` : ""}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3 pl-0.5 text-sm">
          {session.userAgent && <p className="truncate text-oh-stone/60">{session.userAgent}</p>}
          <p className="text-oh-stone/70">{session.sectionViews.map((v) => `${v.sectionKey} ${formatMinutes(v.seconds)}`).join(" · ") || "No sections recorded."}</p>
          {summaries.map((v) => (
            <div key={v.id} className="rounded-lg border-l-4 border-oh-ember bg-oh-linen/60 px-3 py-2">
              <p className="text-xs text-oh-stone/60">
                Chappy&apos;s take · {formatDate(v.visitEnd)} · {formatMinutes(v.seconds)}
                {v.chatCount ? ` · ${v.chatCount} question${v.chatCount === 1 ? "" : "s"}` : ""}
                {v.emailedAt ? " · emailed" : v.error ? ` · not emailed (${v.error})` : ""}
              </p>
              {v.verdict && <p className="mt-1 font-semibold text-oh-charcoal">{v.verdict}</p>}
              {v.take && <p className="mt-1 text-oh-stone">{v.take}</p>}
            </div>
          ))}
          {session.chatMessages && session.chatMessages.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold text-oh-ember-deep">
                Chat with Chappy ({session.chatMessages.filter((m) => m.role === "user").length} questions)
              </summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {session.chatMessages.map((m) => (
                  <div key={m.id} className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-1.5 ${m.role === "user" ? "self-end bg-oh-charcoal text-oh-cream" : "self-start bg-oh-linen text-oh-charcoal"}`}>
                    {m.content}
                    {m.escalated && <span className="mt-1 block text-xs text-oh-ember">Escalated to you</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

function QuestionRow({ question, onAnswered }: { question: CodeDetail["questions"][number]; onAnswered: () => void }) {
  const { show } = useToast();
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const body = answer.trim();
    if (!body) return;
    setSaving(true);
    try {
      await api(`/admin/plan/questions/${question.id}/answer`, { method: "PATCH", body: { answerBody: body } });
      onAnswered();
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-oh-stone/10 py-3 first:border-0">
      <p className="text-xs text-oh-stone/60">{formatDate(question.createdAt)} · {question.sectionKey}{question.contactEmail ? ` · ${question.contactEmail}` : ""}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[15px] text-oh-charcoal">{question.body}</p>
      {question.answeredAt ? (
        <div className="mt-2 rounded-lg border-l-4 border-oh-olive bg-oh-linen/50 px-3 py-2 text-[15px]">
          <p className="text-xs text-oh-stone/60">Answered {formatDate(question.answeredAt)}</p>
          <p className="mt-1 whitespace-pre-wrap text-oh-charcoal">{question.answerBody}</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
          <TextArea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Record your answer (sent to them separately)" className="flex-1" />
          <Button variant="primary" onClick={save} loading={saving} disabled={saving || !answer.trim()}>Save</Button>
        </div>
      )}
    </div>
  );
}

export default function PlanCodeDetailPage({ params }: { params: Promise<{ codeId: string }> }) {
  const { codeId } = use(params);
  const res = useResource(`plan-code:${codeId}`, (signal) => api<{ code: CodeDetail; heat: HeatRow[] }>(`/admin/plan/codes/${codeId}`, { signal }));
  const code = res.data?.code;
  const heat = res.data?.heat ?? [];

  if (!code) {
    return (
      <>
        <PageHeader title="Plan code" back={BACK} />
        {res.error
          ? <ErrorCard message="Couldn't load this code." onRetry={res.reload} />
          : <div className="space-y-4"><Skeleton className="h-24 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  const maxSeconds = Math.max(1, ...heat.map((h) => h.seconds));

  return (
    <>
      <PageHeader title={code.label} back={BACK}
        subtitle={<>
          <span className="font-mono">{code.code}</span> · {code.audience} · default {code.defaultScenario} · sections {code.allowedSections.length ? code.allowedSections.join(", ") : "all"} · expires {formatDate(code.expiresAt)} · max sessions {code.maxSessions ?? "unlimited"}
        </>}
        actions={<Badge tone={statusTone(code.status)}>{code.status}</Badge>} />

      <div className="mb-5">
        <code className="block truncate rounded-lg border border-oh-stone/15 bg-oh-cream px-3 py-2 text-sm text-oh-charcoal">{planInviteUrl(code.code)}</code>
      </div>

      <div className="space-y-5">
        <InvitePanel code={code} onChanged={res.reload} />
        <NdaPanel codeId={codeId} />

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card title="Time per section">
            {heat.length === 0 ? (
              <p className="text-[15px] text-oh-stone/70">No views yet.</p>
            ) : (
              <div className="space-y-3">
                {heat.map((h) => (
                  <div key={h.sectionKey}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-oh-charcoal">{h.sectionKey}</span>
                      <span className="tabular-nums text-oh-stone/70">{formatMinutes(h.seconds)} · {h.interactions} interactions</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-oh-stone/15">
                      <div className="h-full rounded-full bg-oh-ember" style={{ width: `${Math.round((h.seconds / maxSeconds) * 100)}%` }} /> {/* style-ok: progress width */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Sessions (${code.sessions.length})`} padded={false}>
            {code.sessions.length === 0 ? (
              <p className="px-4 py-4 text-[15px] text-oh-stone/70">Not opened yet.</p>
            ) : (
              <ul className="divide-y divide-oh-stone/10 px-4">
                {code.sessions.map((s) => <SessionCard key={s.id} session={s} />)}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Questions (${code.questions.length})`}>
          {code.questions.length === 0 ? (
            <p className="text-[15px] text-oh-stone/70">None submitted.</p>
          ) : (
            code.questions.map((q) => <QuestionRow key={q.id} question={q} onAnswered={res.reload} />)
          )}
        </Card>
      </div>
    </>
  );
}
