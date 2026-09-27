"use client";
import { useCallback, useEffect, useState } from "react";
import { PromoAnalytics } from "@/components/promos/PromoAnalytics";
import { PromoSheet } from "@/components/promos/PromoSheet";
import { useLocationFilter } from "@/components/providers/LocationProvider";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { runOptimistic } from "@/lib/optimistic";
import {
  formatDiscount, hasTargeting, statusLabel, usageText,
  type PromoAnalytics as PromoAnalyticsData, type PromoCode,
} from "@/lib/promo";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");
const STATUS_TONE = { Expired: "alert", Active: "good", Inactive: "neutral" } as const;

export default function PromosPage() {
  const { show } = useToast();
  const ask = useConfirm();
  const { locations } = useLocationFilter();
  const [showInactive, setShowInactive] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [sheet, setSheet] = useState<{ promo: PromoCode | null } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  const res = useResource(`promos:${showInactive}`,
    (signal) => api<PromoCode[]>("/promo-codes", { signal, query: showInactive ? {} : { active: "true" } }));
  const [promos, setPromos] = useState<PromoCode[] | null>(null);
  useEffect(() => { if (res.data) setPromos(res.data); }, [res.data]);

  const analyticsRes = useResource(showAnalytics ? "promos:analytics" : null,
    (signal) => api<PromoAnalyticsData>("/admin/promo-codes/analytics", { signal }));

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setSheet({ promo: null });
  }, []);

  const markBusy = (id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const setActive = (id: string, v: boolean) => setPromos((list) => list && list.map((p) => (p.id === id ? { ...p, isActive: v } : p)));

  const toggle = useCallback(async function toggle(promo: PromoCode, next: boolean, isUndo = false) {
    markBusy(promo.id, true);
    const ok = await runOptimistic({
      apply: () => setActive(promo.id, next),
      revert: () => setActive(promo.id, !next),
      commit: () => api(`/admin/promo-codes/${promo.id}`, { method: "PATCH", body: { isActive: next } }),
    });
    markBusy(promo.id, false);
    if (!ok) { show({ message: `Couldn't update ${promo.code}. Try again.`, tone: "alert" }); return; }
    show({
      message: next ? `${promo.code} is active` : `${promo.code} is inactive`,
      tone: next ? "good" : "info",
      action: isUndo ? undefined : { label: "Undo", onClick: () => { toggle(promo, !next, true); } },
      durationMs: isUndo ? undefined : 5000,
    });
  }, [show]);

  async function remove(promo: PromoCode) {
    const ok = await ask({ title: `Delete promo code "${promo.code}"?`, body: "Codes with usage history are deactivated instead of deleted.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      const data = await api<{ message: string }>(`/promo-codes/${promo.id}`, { method: "DELETE" });
      setPromos((list) => list && list.filter((p) => p.id !== promo.id));
      show({ message: data.message, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => show({ message: `Copied ${code}`, tone: "good" })).catch(() => {});
  }

  const COLUMNS: Column<PromoCode>[] = [
    { key: "code", label: "Code", render: (p) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <code className="rounded bg-oh-stone/10 px-2 py-1 font-mono text-[15px] font-semibold text-oh-charcoal">{p.code}</code>
        <IconButton icon="copy" label={`Copy ${p.code}`} onClick={() => copy(p.code)} className="text-oh-stone/70 hover:text-oh-charcoal" />
        {hasTargeting(p) && <Badge tone="pending">Targeted</Badge>}
        {p.description && <span className="block w-full text-sm text-oh-stone/60">{p.description}</span>}
      </span>
    ) },
    { key: "type", label: "Type", render: (p) => p.discountType.replace(/_/g, " ") },
    { key: "discount", label: "Discount", render: (p) => <span className="font-semibold">{formatDiscount(p)}</span> },
    { key: "scope", label: "Scope", render: (p) => <Badge tone={p.scope === "ALL" ? "info" : "neutral"}>{p.scope}</Badge> },
    { key: "usage", label: "Usage", align: "right", render: (p) => usageText(p) },
    { key: "status", label: "Status", render: (p) => (
      <span className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[statusLabel(p)]}>{statusLabel(p)}</Badge>
        <Toggle checked={p.isActive} disabled={busy.has(p.id)} hideLabel label={`Active: ${p.code}`} onChange={(v) => toggle(p, v)} />
      </span>
    ) },
    { key: "expires", label: "Expires", render: (p) => (p.expiresAt ? shortDate(p.expiresAt) : "Never") },
    { key: "actions", label: "Actions", render: (p) => (
      <span className="flex gap-1.5">
        <Button size="sm" onClick={() => setSheet({ promo: p })}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => remove(p)}>Delete</Button>
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Promos" actions={<Button variant="primary" icon="plus" onClick={() => setSheet({ promo: null })}>New promo</Button>} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={showInactive} onClick={() => setShowInactive((v) => !v)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${showInactive ? "border-oh-charcoal bg-oh-charcoal text-oh-cream" : "border-oh-stone/20 bg-oh-cream text-oh-stone hover:border-oh-stone/40"}`}>
              Show inactive
            </button>
            <button type="button" aria-pressed={showAnalytics} onClick={() => setShowAnalytics((v) => !v)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${showAnalytics ? "border-oh-charcoal bg-oh-charcoal text-oh-cream" : "border-oh-stone/20 bg-oh-cream text-oh-stone hover:border-oh-stone/40"}`}>
              Show analytics
            </button>
          </div>
          {promos && <span className="text-sm tabular-nums text-oh-stone/60">{promos.length} {promos.length === 1 ? "code" : "codes"}</span>}
        </div>

        {showAnalytics && (
          analyticsRes.error && !analyticsRes.data
            ? <ErrorCard message="Couldn't load analytics." onRetry={analyticsRes.reload} />
            : !analyticsRes.data ? <SkeletonList rows={3} /> : <PromoAnalytics data={analyticsRes.data} />
        )}

        {res.error && !promos ? (
          <ErrorCard message="Couldn't load promo codes." onRetry={res.reload} />
        ) : !promos ? (
          <SkeletonList rows={5} />
        ) : (
          <DataList rows={promos} rowKey={(p) => p.id} columns={COLUMNS}
            empty={<EmptyState icon="tag" title="No promo codes yet" body="Create your first one." action={<Button variant="primary" icon="plus" onClick={() => setSheet({ promo: null })}>New promo</Button>} />}
            renderCard={(p) => (
              <div className="space-y-2.5 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <code className="rounded bg-oh-stone/10 px-2 py-1 font-mono text-[15px] font-semibold text-oh-charcoal">{p.code}</code>
                    <IconButton icon="copy" label={`Copy ${p.code}`} onClick={() => copy(p.code)} className="text-oh-stone/70" />
                    {hasTargeting(p) && <Badge tone="pending">Targeted</Badge>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={STATUS_TONE[statusLabel(p)]}>{statusLabel(p)}</Badge>
                    <Toggle checked={p.isActive} disabled={busy.has(p.id)} hideLabel label={`Active: ${p.code}`} onChange={(v) => toggle(p, v)} />
                  </span>
                </div>
                {p.description && <p className="text-sm text-oh-stone/70">{p.description}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-oh-stone">
                  <span className="font-semibold text-oh-charcoal">{formatDiscount(p)}</span>
                  <Badge tone="neutral">{p.scope}</Badge>
                  <span className="tabular-nums text-oh-stone/70">{usageText(p)} used</span>
                  <span className="text-oh-stone/70">Expires {p.expiresAt ? shortDate(p.expiresAt) : "Never"}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => setSheet({ promo: p })}>Edit</Button>
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => remove(p)}>Delete</Button>
                </div>
              </div>
            )} />
        )}
      </div>

      {sheet && (
        <PromoSheet key={sheet.promo?.id ?? "new"} open promo={sheet.promo} locations={locations}
          onClose={() => setSheet(null)}
          onSaved={(saved, created) => {
            setPromos((list) => (list ? (created ? [saved, ...list] : list.map((p) => (p.id === saved.id ? saved : p))) : list));
            setSheet(null);
            show({ message: created ? `${saved.code} created` : `${saved.code} saved`, tone: "good" });
            if (showAnalytics) analyticsRes.reload();
          }} />
      )}
    </>
  );
}
