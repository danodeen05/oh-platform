"use client";

/**
 * The top bar's Back chevron during the order flow (Task D5). The step on
 * screen publishes where Back goes (and its translated label); the shell's
 * TopBar shows the chevron while one is set. A tiny module store rather than
 * a context so the flow never has to wrap the shell.
 */
import { useEffect, useSyncExternalStore } from "react";

export type OrderBack = { href: string; label: string } | null;

let current: OrderBack = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setOrderBack(next: OrderBack): void {
  if (current?.href === next?.href && current?.label === next?.label) return;
  current = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOrderBack(): OrderBack {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Publishes `back` while the calling component is mounted. */
export function usePublishOrderBack(href: string | null, label: string): void {
  useEffect(() => {
    setOrderBack(href ? { href, label } : null);
  }, [href, label]);
  useEffect(() => () => setOrderBack(null), []);
}
