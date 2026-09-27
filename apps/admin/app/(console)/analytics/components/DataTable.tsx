"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataList, type Column as DataListColumn } from "@/components/ui/DataList";

export type DataTableColumn<T> = { key: string; label: string; align?: "left" | "right"; render?: (row: T) => ReactNode };

function cell(value: ReactNode): ReactNode {
  return value === null || value === undefined || value === "" ? "-" : value;
}

/**
 * The analytics kit's table: a title, an optional "Show all (n)" toggle
 * past `defaultLimit` rows, and DataList underneath (cards on phone, a
 * table from lg). The card mode shows the first two columns plus the last.
 */
export function DataTable<T>({ title, columns, rows, defaultLimit = 10 }: { title: string; columns: DataTableColumn<T>[]; rows: T[]; defaultLimit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = rows.length > defaultLimit;
  const shown = !expanded && hasMore ? rows.slice(0, defaultLimit) : rows;
  const value = (row: T, c: DataTableColumn<T>) => cell(c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]);

  const dlColumns: DataListColumn<T>[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align, render: (row) => value(row, c) }));
  const first = columns[0];
  const second = columns[1];
  const last = columns[columns.length - 1];

  return (
    <Card title={title} padded={false}
      action={hasMore && (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? `Show top ${defaultLimit}` : `Show all (${rows.length})`}
        </Button>
      )}>
      <DataList rows={shown} rowKey={(row) => String(rows.indexOf(row))} columns={dlColumns}
        empty={<p className="px-4 py-10 text-center text-[15px] text-oh-stone/60">No data yet</p>}
        renderCard={(row) => (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-oh-charcoal">{value(row, first)}</div>
              {second && <div className="mt-0.5 truncate text-sm text-oh-stone/70">{value(row, second)}</div>}
            </div>
            {last && last !== first && (
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-oh-charcoal">{value(row, last)}</div>
            )}
          </div>
        )} />
    </Card>
  );
}
