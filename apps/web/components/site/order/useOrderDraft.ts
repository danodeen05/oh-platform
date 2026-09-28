"use client";

/**
 * React side of the draft cart (lib/site/order-draft.ts): state mirrored to
 * sessionStorage `oh-order-draft` on every change. `ready` turns true after
 * the first client read, so server HTML never flashes a wrong choice.
 *
 * Nothing is written back until the stored draft has been read into state
 * (`ready`): otherwise the first effect pass (and React's dev double-run of
 * effects) would store the empty initial draft over the real one.
 */
import { useCallback, useEffect, useState } from "react";
import { emptyDraft, loadDraft, saveDraft, type OrderDraft } from "@/lib/site/order-draft";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function useOrderDraft() {
  const [state, setState] = useState<{ draft: OrderDraft; ready: boolean }>({ draft: emptyDraft(), ready: false });

  useEffect(() => {
    setState((s) => (s.ready ? s : { draft: loadDraft(storage()), ready: true }));
  }, []);

  useEffect(() => {
    if (state.ready) saveDraft(storage(), state.draft);
  }, [state]);

  const update = useCallback((fn: (d: OrderDraft) => OrderDraft) => setState((s) => ({ ...s, draft: fn(s.draft) })), []);

  return { draft: state.draft, ready: state.ready, update };
}
