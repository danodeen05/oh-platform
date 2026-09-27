"use client";
import Link from "next/link";
import { use, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { denverDateTime, money, shortDate } from "@/lib/format";
import {
  adjustmentCents, adjustmentPrompt, percentUsed, purchaserName, recipientName, statusTone,
  CARD_STATUSES, type GiftCardDetail,
} from "@/lib/gift-cards";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/gift-cards", label: "Gift cards" };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

function AdjustBalanceSheet({ card, onClose, onSaved }: { card: GiftCardDetail; onClose: () => void; onSaved: (c: GiftCardDetail) => void }) {
  const { show } = useToast();
  const ask = useConfirm();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const cents = adjustmentCents(amount);
    const errs: { amount?: string; reason?: string } = {};
    if (cents === null || cents === 0) errs.amount = "Enter a non-zero amount.";
    if (!reason.trim()) errs.reason = "A reason is required.";
    setErrors(errs);
    if (errs.amount || errs.reason || cents === null) return;

    const ok = await ask({ title: adjustmentPrompt(card.code, cents), confirmLabel: cents >= 0 ? "Add balance" : "Remove balance", tone: cents < 0 ? "danger" : "primary" });
    if (!ok) return;

    setSaving(true);
    try {
      const saved = await api<GiftCardDetail>(`/admin/gift-cards/${card.id}`, { method: "PATCH", body: { balanceAdjustment: cents, adjustmentReason: reason.trim() } });
      onSaved(saved);
    } catch (e) {
      show({ message: `Couldn't adjust balance. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Adjust balance" size="auto" footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>Apply adjustment</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Amount" hint="In dollars; use a minus sign to remove balance" error={errors.amount}>
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5.00 or -5.00" aria-invalid={Boolean(errors.amount)} />
        </Field>
        <Field label="Reason" error={errors.reason}>
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer service credit" aria-invalid={Boolean(errors.reason)} />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default function GiftCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`gift-card:${id}`, (signal) => api<GiftCardDetail>(`/admin/gift-cards/${encodeURIComponent(id)}`, { signal }));
  const [card, setCard] = useState<GiftCardDetail | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [seededId, setSeededId] = useState<string | null>(null);
  if (res.data && seededId !== res.data.id) {
    setCard(res.data);
    setStatus(res.data.status);
    setNotes(res.data.adminNotes ?? "");
    setSeededId(res.data.id);
  }

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!card) {
    return (
      <>
        <PageHeader title="Gift card" back={BACK} />
        {res.error
          ? <ErrorCard message={res.error === "Gift card not found" ? "This gift card doesn't exist." : "Couldn't load this gift card."} onRetry={res.error === "Gift card not found" ? undefined : res.reload} />
          : <div className="space-y-4"><Skeleton className="h-32 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  const usedCents = card.amountCents - card.balanceCents;

  async function save() {
    setSaving(true);
    try {
      const saved = await api<GiftCardDetail>(`/admin/gift-cards/${card!.id}`, { method: "PATCH", body: { status, adminNotes: notes || null } });
      setCard(saved);
      show({ message: "Gift card updated.", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    const ok = await ask({ title: `Deactivate ${card!.code}?`, body: "This prevents it from being used. You can reactivate it later.", confirmLabel: "Deactivate", tone: "danger" });
    if (!ok) return;
    try {
      const saved = await api<GiftCardDetail>(`/admin/gift-cards/${card!.id}`, { method: "PATCH", body: { status: "CANCELLED" } });
      setCard(saved); setStatus(saved.status);
      show({ message: "Gift card deactivated.", tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function reactivate() {
    const ok = await ask({ title: `Reactivate ${card!.code}?`, confirmLabel: "Reactivate" });
    if (!ok) return;
    try {
      const saved = await api<GiftCardDetail>(`/admin/gift-cards/${card!.id}`, { method: "PATCH", body: { status: "ACTIVE" } });
      setCard(saved); setStatus(saved.status);
      show({ message: "Gift card reactivated.", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  return (
    <>
      <PageHeader title={card.code} back={BACK} subtitle={`Purchased ${denverDateTime(card.purchasedAt)}`}
        actions={<Badge tone={statusTone(card.status)}>{card.status}</Badge>} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <Card title="Balance" action={<Button variant="secondary" size="sm" onClick={() => setAdjustOpen(true)}>Adjust balance</Button>}>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-xs text-oh-stone/70">Original</p><p className="font-display text-[1.5rem] text-oh-charcoal">{money(card.amountCents)}</p></div>
              <div><p className="text-xs text-oh-stone/70">Used</p><p className="font-display text-[1.5rem] text-oh-stone">{money(usedCents)}</p></div>
              <div><p className="text-xs text-oh-stone/70">Remaining</p><p className="font-display text-[1.5rem] text-oh-olive">{money(card.balanceCents)}</p></div>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-oh-stone/15">
              <div className="h-full rounded-full bg-oh-olive" style={{ width: `${100 - percentUsed(card.amountCents, card.balanceCents)}%` }} /> {/* style-ok: progress width */}
            </div>
            <p className="mt-1.5 text-sm text-oh-stone/70">{percentUsed(card.amountCents, card.balanceCents).toFixed(1)}% used</p>
          </Card>

          <Card title="Usage history" padded={false}>
            {card.shopOrders.length === 0 ? (
              <p className="px-4 py-4 text-[15px] text-oh-stone/70">This gift card hasn&apos;t been used yet.</p>
            ) : card.shopOrders.map((o) => (
              <Link key={o.id} href={`/shop-orders/${o.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-oh-linen/60">
                <span className="font-semibold text-oh-charcoal underline-offset-4 hover:underline">#{o.orderNumber}</span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums text-oh-ember-deep">−{money(o.giftCardApplied)}</span>
                  <span className="tabular-nums text-oh-stone/60">{shortDate(o.createdAt)}</span>
                </span>
              </Link>
            ))}
          </Card>

          <Card title="Admin controls">
            <div className="space-y-4">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {CARD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Admin notes" hint="Internal, not shown to the customer">
                <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={save} loading={saving}>Save</Button>
                {card.status === "ACTIVE" && <Button variant="danger" onClick={deactivate}>Deactivate</Button>}
                {card.status === "CANCELLED" && <Button variant="secondary" onClick={reactivate}>Reactivate</Button>}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card title="Purchaser">
            <p className="text-[17px] font-semibold text-oh-charcoal">{purchaserName(card)}</p>
            {card.purchaser?.email && <p className="mt-0.5 text-sm text-oh-stone/70">{card.purchaser.email}</p>}
          </Card>

          <Card title="Recipient">
            {card.recipientEmail ? (
              <>
                <p className="text-[17px] font-semibold text-oh-charcoal">{recipientName(card)}</p>
                <p className="mt-0.5 text-sm text-oh-stone/70">{card.recipientEmail}</p>
                {card.personalMessage && (
                  <p className="mt-3 rounded-lg border border-oh-stone/15 bg-oh-linen/50 p-3 text-[15px] italic text-oh-stone">&ldquo;{card.personalMessage}&rdquo;</p>
                )}
              </>
            ) : (
              <p className="text-[15px] text-oh-stone">Purchased for self.</p>
            )}
          </Card>

          <Card title="Payment">
            {card.stripePaymentId
              ? <p className="break-all font-mono text-xs text-oh-stone/60">{card.stripePaymentId}</p>
              : <p className="text-[15px] text-oh-stone/70">No payment info available.</p>}
          </Card>

          <Card title="Details">
            <div className="space-y-2 text-[15px]">
              <div className="flex justify-between"><span className="text-oh-stone/70">Design</span><span className="text-oh-charcoal">{card.designId || "Default"}</span></div>
              <div className="flex justify-between"><span className="text-oh-stone/70">Purchased</span><span className="tabular-nums text-oh-charcoal">{shortDate(card.purchasedAt)}</span></div>
              <div className="flex justify-between"><span className="text-oh-stone/70">Expires</span><span className="tabular-nums text-oh-charcoal">{card.expiresAt ? shortDate(card.expiresAt) : "Never"}</span></div>
            </div>
          </Card>
        </div>
      </div>

      {adjustOpen && (
        <AdjustBalanceSheet card={card} onClose={() => setAdjustOpen(false)}
          onSaved={(saved) => { setCard(saved); setStatus(saved.status); setAdjustOpen(false); show({ message: "Balance adjusted.", tone: "good" }); }} />
      )}
    </>
  );
}
