"use client";
import Link from "next/link";
import { useState } from "react";
import { OrdersTabs } from "@/components/orders/OrdersTabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { FilterChips, type ChipOption } from "@/components/ui/FilterChips";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import {
  caseAge, customerName, isUrgent, CASE_TYPES, STATUS_LABEL, STATUS_TONE, TYPE_LABEL, typeLabel,
  type CaseList, type CaseListItem, type CaseStatus, type CaseType,
} from "@/lib/support";
import { useResource } from "@/lib/use-resource";

const STATUS_OPTIONS: ChipOption<CaseStatus>[] = [
  { value: "OPEN", label: "Open" }, { value: "RESOLVED", label: "Resolved" }, { value: "DECLINED", label: "Declined" },
];
const TYPE_OPTIONS: ChipOption<"ALL" | CaseType>[] = [{ value: "ALL", label: "All types" }, ...CASE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))];
const PAGE = 50;

function Age({ c }: { c: CaseListItem }) {
  const { label, stale } = caseAge(c.createdAt);
  return <Badge tone={c.status === "OPEN" && stale ? "alert" : "neutral"}>{label}</Badge>;
}

function Urgent({ c }: { c: CaseListItem }) {
  return isUrgent(c) ? <Badge tone="alert">Urgent</Badge> : null;
}

const orderText = (c: CaseListItem) => (c.order?.orderNumber ? `#${c.order.orderNumber}` : null);

const COLUMNS: Column<CaseListItem>[] = [
  { key: "case", label: "Case", render: (c) => (
    <span className="flex min-w-0 items-center gap-2">
      <Link href={`/support/${c.id}`} className="block min-w-0 max-w-[15rem] truncate font-semibold text-oh-charcoal underline-offset-4 hover:underline 2xl:max-w-[24rem]">{c.summary}</Link>
      <Urgent c={c} />
    </span>
  ) },
  { key: "type", label: "Type", render: (c) => <span className="whitespace-nowrap">{typeLabel(c.type)}</span> },
  { key: "customer", label: "Customer", render: (c) => <span className="block max-w-[11rem] truncate">{customerName(c)}</span> },
  { key: "order", label: "Order", render: (c) => (c.order ? (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums"><span className="block max-w-[9rem] truncate" title={orderText(c) ?? undefined}>{orderText(c)}</span><span className="text-oh-stone/60">{money(c.order.totalCents)}</span></span>
  ) : <span className="text-oh-ash">None</span>) },
  { key: "status", label: "Status", align: "right", render: (c) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge><Age c={c} /></span>
  ) },
];

export default function SupportPage() {
  const [status, setStatus] = useState<CaseStatus>("OPEN");
  const [type, setType] = useState<"ALL" | CaseType>("ALL");
  const [more, setMore] = useState<CaseListItem[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined); // undefined: no extra page loaded yet
  const [loadingMore, setLoadingMore] = useState(false);

  const key = `support:${status}:${type}`;
  const res = useResource(key, (signal) => api<CaseList>("/admin/support/cases", { signal, query: { status, type: type === "ALL" ? undefined : type, limit: PAGE } }), { refreshMs: 30_000 });
  const first = res.data?.cases;
  const [pagedFor, setPagedFor] = useState(key);
  if (pagedFor !== key) { setPagedFor(key); setMore([]); setCursor(undefined); }
  const nextCursor = cursor !== undefined ? cursor : res.data?.nextCursor ?? null;
  const cases = first ? [...first, ...more.filter((m) => !first.some((f) => f.id === m.id))] : undefined;

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api<CaseList>("/admin/support/cases", { query: { status, type: type === "ALL" ? undefined : type, limit: PAGE, cursor: nextCursor } });
      setMore((m) => [...m, ...page.cases]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader title="Support" subtitle="Cases from Chappy and the contact form." />
      <div className="space-y-4">
        <OrdersTabs current="support">
          <div className="space-y-2">
            <FilterChips<CaseStatus> label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            <FilterChips<"ALL" | CaseType> label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
          </div>
        </OrdersTabs>

        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">{STATUS_LABEL[status]}</h2>
          {cases && <span className="text-sm tabular-nums text-oh-stone/60">{cases.length}{nextCursor ? "+" : ""} {cases.length === 1 ? "case" : "cases"}</span>}
        </div>

        {res.error && !cases ? (
          <ErrorCard message="Couldn't load support cases." onRetry={res.reload} />
        ) : !cases ? (
          <SkeletonList rows={5} />
        ) : (
          <DataList rows={cases} rowKey={(c) => c.id} columns={COLUMNS}
            empty={<EmptyState icon="check" title={status === "OPEN" ? "Nothing waiting" : "No cases here"} body={status === "OPEN" ? "New cases from Chappy and the contact form show up here." : undefined} />}
            renderCard={(c) => (
              <ListRow href={`/support/${c.id}`} title={c.summary}
                meta={[typeLabel(c.type), customerName(c), orderText(c)].filter(Boolean).join(" · ")}
                trailing={<span className="flex flex-col items-end gap-1.5"><Urgent c={c} /><Age c={c} /></span>} />
            )} />
        )}

        {cases && nextCursor && (
          <div className="flex justify-center">
            <Button onClick={loadMore} loading={loadingMore}>Show more</Button>
          </div>
        )}
      </div>
    </>
  );
}
