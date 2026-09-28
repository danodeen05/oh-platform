"use client";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { useRole } from "@/components/providers/RoleProvider";
import { RefundDialog } from "@/components/support/RefundDialog";
import { ResolveActions } from "@/components/support/ResolveActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, MoneyInput, TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { denverDateTime, money } from "@/lib/format";
import { paymentLabel, paymentTone } from "@/lib/orders";
import {
  canFullRefund, caseAge, customerName, isUrgent, normalizeTranscript, refundState, resolveBody, resolveErrorMessage,
  RESOLUTION_LABEL, STATUS_LABEL, STATUS_TONE, TIER_LABEL, typeLabel,
  type CaseDetail, type ResolveAction, type ResolveInput,
} from "@/lib/support";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/support", label: "Support" };

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-[15px] ${strong ? "font-semibold text-oh-charcoal" : "text-oh-stone"}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function Transcript({ raw }: { raw: unknown }) {
  const turns = normalizeTranscript(raw);
  if (turns.length === 0) return <p className="text-[15px] text-oh-stone/70">No conversation was attached to this case.</p>;
  return (
    <ol className="space-y-3" aria-label="Conversation">
      {turns.map((t, i) => {
        const guest = t.who === "guest";
        return (
          <li key={i} className={`flex ${guest ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${guest ? "rounded-br-md bg-oh-charcoal text-oh-cream" : "rounded-bl-md border border-oh-stone/15 bg-oh-paper text-oh-charcoal"}`}>
              <span className={`mb-0.5 block text-xs font-semibold uppercase tracking-[0.06em] ${guest ? "text-oh-cream/70" : "text-oh-stone/60"}`}>
                {t.who === "guest" ? "Guest" : t.who === "chappy" ? "Chappy" : t.who === "staff" ? "Staff" : "Note"}
              </span>
              <span className="whitespace-pre-wrap break-words">{t.text}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type OpenSheet = null | "credit" | "refund" | "decline";

export default function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const role = useRole();
  const { show } = useToast();
  // Polls so a card refund someone else started shows up and clears on its own.
  const res = useResource(`support:${id}`, (signal) => api<CaseDetail>(`/admin/support/cases/${encodeURIComponent(id)}`, { signal }), { refreshMs: 15_000 });
  const d = res.data;

  const [open, setOpen] = useState<OpenSheet>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [closeKind, setCloseKind] = useState<"decline" | "close">("decline");

  function openSheet(s: OpenSheet) { setError(null); setRetry(false); setReason(""); setAmountCents(null); setOpen(s); }
  function closeSheet() { if (!inFlight.current) setOpen(null); }

  async function submit(action: ResolveAction, input: ResolveInput) {
    if (inFlight.current) return; // no double submit
    const maxCents = d?.limits.staffCreditMaxCents;
    const built = resolveBody(action, input, maxCents);
    if ("error" in built) { setError(built.error); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: boolean; alreadyResolved?: boolean }>(`/admin/support/cases/${encodeURIComponent(id)}/resolve`, { method: "POST", body: built.body });
      setOpen(null);
      if (r.alreadyResolved) show({ message: "Someone already resolved this case.", tone: "info" });
      else show({ message: action === "credit" ? `Gave ${money(input.amountCents)} store credit.` : action === "full_refund" ? "Order refunded to the card." : action === "decline" ? "Case declined." : "Case closed.", tone: "good" });
      res.reload();
    } catch (err) {
      const e = err instanceof ApiError ? resolveErrorMessage(err.status, err.body) : { message: "Can't reach the server. Try again.", retry: true };
      setError(e.message);
      setRetry(Boolean(e.retry));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!d) {
    const missing = res.error === "Case not found";
    return (
      <>
        <PageHeader title="Case" back={BACK} />
        {res.error
          ? <ErrorCard message={missing ? "This case doesn't exist." : "Couldn't load this case."} onRetry={missing ? undefined : res.reload} />
          : <div className="space-y-4"><Skeleton className="h-32 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  const c = d.case;
  const o = d.order;
  const m = d.customer;
  const isOpen = c.status === "OPEN";
  const showRefund = canFullRefund(role, o);
  const refund = refundState(c, d.limits.refundLeaseMs);
  const age = caseAge(c.createdAt);
  const contact = [c.contact?.name, c.contact?.email, c.contact?.phone].filter(Boolean).join(", ");
  const maxDollars = (d.limits.staffCreditMaxCents / 100).toFixed(2);

  return (
    <>
      <PageHeader title={typeLabel(c.type)} back={BACK}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            {isUrgent(c) && <Badge tone="alert">Urgent</Badge>}
            {refund.pending && <Badge tone="pending">{refund.stale ? "Refund stalled" : "Refund in progress"}</Badge>}
            <span>{[denverDateTime(c.createdAt), isOpen ? `waiting ${age.label}` : null, c.locale && c.locale !== "en" ? `Language: ${c.locale}` : null].filter(Boolean).join(" · ")}</span>
          </span>
        } />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <Card title="What happened">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-oh-charcoal">{c.summary}</p>
          </Card>
          <Card title="Conversation"><Transcript raw={c.transcript} /></Card>
          {!isOpen && (
            <Card title="Resolution">
              <div className="space-y-1.5">
                <Line label="Outcome" value={c.resolution ? RESOLUTION_LABEL[c.resolution] ?? c.resolution : STATUS_LABEL[c.status]} strong />
                {c.amountCents != null && c.resolution !== "DECLINED" && c.resolution !== "INFO" && <Line label="Amount" value={money(c.amountCents)} />}
                {c.resolvedAt && <Line label="When" value={denverDateTime(c.resolvedAt)} />}
                {c.resolvedBy && <Line label="By" value={c.resolvedBy} />}
              </div>
              {c.resolutionNote && <p className="mt-3 border-t border-oh-stone/15 pt-3 text-[15px] text-oh-stone">{c.resolutionNote}</p>}
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6">
          {isOpen && (
            <ResolveActions role={role} order={o} hasMember={Boolean(m)} busy={busy} refund={refund}
              onCredit={() => openSheet("credit")} onRefund={() => openSheet("refund")} onDecline={() => openSheet("decline")} />
          )}

          <Card title="Guest">
            <p className="text-[17px] font-semibold text-oh-charcoal">{m?.name || customerName({ customer: m ? { name: m.name, email: m.email } : null, contact: c.contact })}</p>
            {m ? (
              <div className="mt-2 space-y-1.5">
                <Line label="Tier" value={m.tier ? TIER_LABEL[m.tier] ?? m.tier : "None"} />
                <Line label="Store credit" value={money(m.creditBalanceCents)} />
                <Line label="Chappy goodwill, lifetime" value={`${money(m.goodwillLifetimeCents)} of ${money(d.limits.goodwillLifetimeCapCents)}`} />
              </div>
            ) : (
              <p className="mt-0.5 text-sm text-oh-stone/70">Not signed in{contact ? "" : ", no contact left"}.</p>
            )}
            {(m?.phone || m?.email || c.contact?.phone || c.contact?.email) && (
              <div className="-mx-2 mt-2 flex flex-col">
                {(m?.phone || c.contact?.phone) && (
                  <a href={`tel:${m?.phone || c.contact?.phone}`} className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[15px] font-semibold text-oh-ember-deep hover:bg-oh-linen">
                    <Icon name="phone" size={18} />{m?.phone || c.contact?.phone}
                  </a>
                )}
                {(m?.email || c.contact?.email) && (
                  <a href={`mailto:${m?.email || c.contact?.email}`} className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2 text-[15px] font-semibold text-oh-ember-deep hover:bg-oh-linen">
                    <Icon name="mail" size={18} className="shrink-0" /><span className="truncate">{m?.email || c.contact?.email}</span>
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card title="Order" action={o ? <Link href={`/orders/${o.id}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-oh-ember-deep underline-offset-4 hover:underline">Open order</Link> : undefined}>
            {!o ? (
              <p className="text-[15px] text-oh-stone/70">No order on this case.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-oh-charcoal">#{o.orderNumber}{o.seatLabel ? ` · Pod ${o.seatLabel}` : ""}</span>
                  <Badge tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Badge>
                </div>
                {o.createdAt && <p className="mt-0.5 text-sm text-oh-stone/70">{denverDateTime(o.createdAt)}{o.hasPaymentIntent ? " · Card payment" : " · No card payment"}</p>}
                <ul className="mt-3 space-y-2">
                  {o.items.map((i, n) => (
                    <li key={n} className="flex justify-between gap-3 text-[15px]">
                      <span className="min-w-0 text-oh-charcoal"><span className="tabular-nums text-oh-stone/70">{i.quantity} ×</span> {i.name}{i.selectedValue ? <span className="text-oh-stone/70">, {i.selectedValue}</span> : null}</span>
                      <span className="shrink-0 tabular-nums text-oh-stone">{money(i.priceCents * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1.5 border-t border-oh-stone/15 pt-3">
                  {o.creditsAppliedCents > 0 && <Line label="Store credit used" value={money(o.creditsAppliedCents)} />}
                  {o.giftCardAppliedCents > 0 && <Line label="Gift card used" value={money(o.giftCardAppliedCents)} />}
                  <Line label="Total" value={money(o.totalCents)} strong />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <Sheet open={open === "credit"} onClose={closeSheet} title="Give store credit" size="auto"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={closeSheet} disabled={busy}>Cancel</Button>
            <Button className="flex-1" variant="primary" loading={busy} data-testid="credit-confirm"
              onClick={() => submit("credit", { amountCents, reason })}>Give {amountCents ? money(amountCents) : "credit"}</Button>
          </div>
        }>
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-oh-stone">Store credit goes on {m?.name || "the member"}&apos;s account and expires in 90 days. It never goes back to a card.</p>
          <Field label="Amount" hint={`Up to $${maxDollars}.`} error={error ?? undefined}>
            <MoneyInput cents={amountCents} onCents={setAmountCents} placeholder="0.00" aria-label="Credit amount in dollars" data-testid="credit-amount" />
          </Field>
          <Field label="Reason" hint="Optional. Saved with the case.">
            <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
        </div>
      </Sheet>

      {showRefund && o && (
        <RefundDialog open={open === "refund"} onClose={closeSheet} busy={busy} retry={retry || refund.pending} error={error}
          totalCents={o.totalCents} orderNumber={o.orderNumber}
          onConfirm={() => submit("full_refund", {})} />
      )}

      <Sheet open={open === "decline"} onClose={closeSheet} title={closeKind === "decline" ? "Decline case" : "Close case"} size="auto"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={closeSheet} disabled={busy}>Cancel</Button>
            <Button className="flex-1" variant="primary" loading={busy} disabled={!reason.trim()} data-testid="decline-confirm"
              onClick={() => submit(closeKind, { reason })}>{closeKind === "decline" ? "Decline" : "Close case"}</Button>
          </div>
        }>
        <div className="space-y-4">
          <SegmentedControl<"decline" | "close"> label="Outcome" value={closeKind} onChange={setCloseKind}
            options={[{ value: "decline", label: "Decline" }, { value: "close", label: "Close, nothing owed" }]} />
          <p className="text-[15px] leading-relaxed text-oh-stone">
            {closeKind === "decline" ? "No money moves. The guest's request is turned down." : "No money moves. Use this when the case is already handled, for example by another case."}
          </p>
          <Field label="Reason" hint="Required. Saved with the case." error={error ?? undefined}>
            <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required data-testid="decline-reason" />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
