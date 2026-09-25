"use client";

import { useId, useState } from "react";

interface Props {
  chart: React.ReactNode;
  table: React.ReactNode;
  labels: { showTable: string; showChart: string };
}

/** Every chart gets a data-table alternative (spec 7.6). */
export function DataTableToggle({ chart, table, labels }: Props) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={id}
          onClick={() => setShowTable((v) => !v)}
          className="rounded-md border border-oh-stone bg-transparent px-3 py-1 text-[0.75rem] text-oh-mute hover:border-oh-mute hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember"
        >
          {showTable ? labels.showChart : labels.showTable}
        </button>
      </div>
      <div id={id}>{showTable ? table : chart}</div>
    </div>
  );
}
