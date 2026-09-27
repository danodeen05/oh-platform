"use client";

import { useEffect } from "react";

/** Tell the API about a print move, for Chappy's visit summary. Fire and forget. */
function track(type: "print_view" | "printed"): void {
  const body = JSON.stringify({ type });
  if (!navigator.sendBeacon?.("/api/plan/event", body)) {
    void fetch("/api/plan/event", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
  }
}

/**
 * Print control on the print route. It also records that the print version
 * was opened and printed. That runs client-side on purpose: Chappy's server
 * fetch of this page (his plan knowledge) runs no scripts, so it never counts
 * as a viewer printing the plan.
 */
export function PrintButton({ label }: { label: string }) {
  useEffect(() => {
    track("print_view");
    const onAfterPrint = () => track("printed");
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-oh-ember-deep px-4 py-2 text-[0.8rem] font-semibold text-oh-cream hover:bg-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-charcoal"
    >
      {label}
    </button>
  );
}
