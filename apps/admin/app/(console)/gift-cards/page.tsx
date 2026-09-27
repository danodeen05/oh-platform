"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRole } from "@/components/providers/RoleProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { controlCls, Field, Select } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import {
  CARD_STATUSES, pageSummary, purchaserName, recipientName, remainingPercent, statusTone,
  type GiftCardStats, type GiftCardSummary, type Pagination,
} from "@/lib/gift-cards";
import { useResource } from "@/lib/use-resource";

const LIMIT = 20;
const EMPTY_PAGE: Pagination = { page: 1, limit: LIMIT, totalCount: 0, totalPages: 0 };
type Filters = { status: string; hasBalance: string; startDate: string; endDate: string };
const EMPTY_FILTERS: Filters = { status: "", hasBalance: "", startDate: "", endDate: "" };

const COLUMNS: Column<GiftCardSummary>[] = [
  { key: "code", label: "Code", render: (c) => (
    <>
      <Link href={`/gift-cards/${c.id}`} className="font-mono font-semibold text-oh-charcoal underline-offset-4 hover:underline">{c.code}</Link>
      <span className="block text-sm text-oh-stone/60">{shortDate(c.purchasedAt)}</span>
    </>
  ) },
  { key: "balance", label: "Remaining / original", render: (c) => (
    <div>
      <span className="tabular-nums">{money(c.balanceCents)}{c.balanceCents !== c.amountCents && <span className="text-oh-stone/60"> / {money(c.amountCents)}</span>}</span>
      {c.balanceCents !== c.amountCents && (
        <div className="mt-1 h-1.5 w-16 rounded-full bg-oh-stone/15">
          <div className="h-full rounded-full bg-oh-olive" style={{ width: `${remainingPercent(c.amountCents, c.balanceCents)}%` }} /> {/* style-ok: progress width */}
        </div>
      )}
    </div>
  ) },
  { key: "status", label: "Status", render: (c) => <Badge tone={statusTone(c.status)}>{c.status}</Badge> },
  { key: "purchaser", label: "Purchaser", render: (c) => purchaserName(c) },
  { key: "recipient", label: "Recipient", render: (c) => recipientName(c) },
  { key: "expires", label: "Expires", render: (c) => (c.expiresAt ? shortDate(c.expiresAt) : "Never") },
];

export default function GiftCardsPage() {
  const role = useRole();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") !== "search") return;
    const id = requestAnimationFrame(() => document.querySelector<HTMLInputElement>('main input[type="search"]')?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => { setPage(1); }, [filters, q]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const activeCount = Object.values(filters).filter(Boolean).length;
  const clear = () => { setFilters(EMPTY_FILTERS); setText(""); setQ(""); };

  const key = `gift-cards:${JSON.stringify(filters)}:${q}:${page}`;
  const res = useResource(key, (signal) => api<{ giftCards: GiftCardSummary[]; pagination: Pagination }>("/admin/gift-cards", {
    signal, query: { page, limit: LIMIT, search: q || undefined, ...filters },
  }));
  const statsRes = useResource("gift-cards:stats", (signal) => api<GiftCardStats>("/admin/gift-cards/stats", { signal }));

  const cards = res.data?.giftCards;
  const pagination = res.data?.pagination ?? EMPTY_PAGE;

  return (
    <>
      <PageHeader title="Gift cards"
        subtitle={role === "owner" ? <Link href="/gift-cards/config" className="font-semibold text-oh-ember-deep hover:underline">Gift card setup</Link> : undefined} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Sold" value={statsRes.data ? statsRes.data.totalCards : "…"} />
          <StatTile label="Active" value={statsRes.data ? statsRes.data.byStatus.active : "…"} />
          <StatTile label="Value sold" value={statsRes.data ? money(statsRes.data.totalSoldCents) : "…"} />
          <StatTile label="Outstanding" value={statsRes.data ? money(statsRes.data.outstandingBalanceCents) : "…"} tone="pending" />
        </div>

        <SearchField value={text} onChange={setText} onSubmit={(v) => setQ(v.trim())} placeholder="Code or email" label="Search gift cards" />

        <FilterBar activeCount={activeCount} onClear={clear}>
          <Field label="Status" className="lg:w-44">
            <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">All</option>
              {CARD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Balance" className="lg:w-44">
            <Select value={filters.hasBalance} onChange={(e) => set("hasBalance", e.target.value)}>
              <option value="">All</option>
              <option value="true">Has balance</option>
              <option value="false">Exhausted</option>
            </Select>
          </Field>
          <Field label="Start date" className="lg:w-40">
            <input type="date" value={filters.startDate} onChange={(e) => set("startDate", e.target.value)} className={controlCls} />
          </Field>
          <Field label="End date" className="lg:w-40">
            <input type="date" value={filters.endDate} onChange={(e) => set("endDate", e.target.value)} className={controlCls} />
          </Field>
          <Button variant="ghost" onClick={clear} className="hidden lg:inline-flex">Clear</Button>
        </FilterBar>

        {res.error && !cards ? (
          <ErrorCard message="Couldn't load gift cards." onRetry={res.reload} />
        ) : !cards ? (
          <SkeletonList rows={6} />
        ) : (
          <DataList rows={cards} rowKey={(c) => c.id} columns={COLUMNS}
            empty={<EmptyState icon="gift" title="No gift cards found" body="Try different filters or clear them." />}
            renderCard={(c) => (
              <Link href={`/gift-cards/${c.id}`} className="block px-4 py-3 transition-colors hover:bg-oh-linen/60 active:bg-oh-linen">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block font-mono text-[15px] font-semibold text-oh-charcoal">{c.code}</span>
                    <span className="block text-sm text-oh-stone/60">{shortDate(c.purchasedAt)}</span>
                  </span>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[15px] font-semibold tabular-nums text-oh-charcoal">{money(c.balanceCents)}</span>
                  {c.balanceCents !== c.amountCents && (
                    <>
                      <span className="text-sm tabular-nums text-oh-stone/60">/ {money(c.amountCents)}</span>
                      <div className="h-1.5 w-16 rounded-full bg-oh-stone/15">
                        <div className="h-full rounded-full bg-oh-olive" style={{ width: `${remainingPercent(c.amountCents, c.balanceCents)}%` }} /> {/* style-ok: progress width */}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-oh-stone/70">
                  <span>{purchaserName(c)} → {recipientName(c)}</span>
                  <span>Expires {c.expiresAt ? shortDate(c.expiresAt) : "Never"}</span>
                </div>
              </Link>
            )} />
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={pagination.page <= 1}>Previous</Button>
            <span className="text-sm tabular-nums text-oh-stone/70">{pageSummary(pagination)}</span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={pagination.page >= pagination.totalPages}>Next</Button>
          </div>
        )}
      </div>
    </>
  );
}
