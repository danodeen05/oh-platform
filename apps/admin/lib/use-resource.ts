"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * Load data for a page: aborts stale requests, keeps the last good data during
 * background refreshes, and (with `refreshMs`) polls only while the tab is visible.
 * `key` identifies the query; when it changes the old data is dropped.
 */
export function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, opts: { refreshMs?: number } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: key !== null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastKey = useRef<string | null>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (key === null) { setState({ data: null, error: null, loading: false }); lastKey.current = null; return; }
    const fresh = lastKey.current !== key;
    lastKey.current = key;
    const ctl = new AbortController();
    setState((s) => (fresh ? { data: null, error: null, loading: true } : { ...s, loading: true }));
    loadRef.current(ctl.signal).then(
      (data) => { if (!ctl.signal.aborted) setState({ data, error: null, loading: false }); },
      (err: unknown) => {
        if (ctl.signal.aborted || (err as Error)?.name === "AbortError") return;
        setState((s) => ({ data: s.data, error: err instanceof Error ? err.message : "Something went wrong.", loading: false }));
      },
    );
    return () => ctl.abort();
  }, [key, tick]);

  const refreshMs = opts.refreshMs;
  useEffect(() => {
    if (!refreshMs || key === null) return;
    const visible = () => document.visibilityState === "visible";
    const id = setInterval(() => { if (visible()) reload(); }, refreshMs);
    const onVis = () => { if (visible()) reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [refreshMs, key, reload]);

  return { ...state, reload };
}
