"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

type Props = { activeCount: number; onClear?: () => void; children: ReactNode };

/**
 * Filter controls: inline from lg, behind a "Filters" button and a Sheet on phone.
 * `children` renders in both places, sharing whatever state it closes over.
 */
export function FilterBar({ activeCount, onClear, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden lg:flex lg:flex-wrap lg:items-end lg:gap-3">{children}</div>
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="secondary" icon="filter" onClick={() => setOpen(true)}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        {onClear && activeCount > 0 && <Button variant="ghost" onClick={onClear}>Clear</Button>}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filters" size="auto"
        footer={
          <div className="flex gap-2">
            {onClear && <Button className="flex-1" onClick={() => { onClear(); setOpen(false); }}>Clear</Button>}
            <Button variant="primary" className="flex-1" onClick={() => setOpen(false)}>Done</Button>
          </div>
        }>
        <div className="space-y-4">{children}</div>
      </Sheet>
    </>
  );
}
