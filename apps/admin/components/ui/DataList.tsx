import type { ReactNode } from "react";

export type Column<T> = { key: string; label: string; align?: "left" | "right"; render: (row: T) => ReactNode };

/** Cards on phones, a table from lg. Same rows, one component. */
export function DataList<T>({ rows, rowKey, columns, renderCard, empty }: {
  rows: T[]; rowKey: (row: T) => string; columns: Column<T>[]; renderCard: (row: T) => ReactNode; empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <ul className="divide-y divide-oh-stone/10 overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream shadow-card lg:hidden">
        {rows.map((r) => <li key={rowKey(r)}>{renderCard(r)}</li>)}
      </ul>
      <div className="hidden overflow-x-auto rounded-card border border-oh-stone/15 bg-oh-cream shadow-card lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-oh-stone/15 text-left text-xs uppercase tracking-[0.08em] text-oh-stone/70">
              {columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-oh-stone/10 transition-colors last:border-0 hover:bg-oh-linen/50">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
