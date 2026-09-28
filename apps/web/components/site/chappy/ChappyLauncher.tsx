"use client";

/**
 * Chappy for the site shell (Task C4). The dock (and any page) opens the
 * chat through `useChappy().openChappy(prefill?)`.
 *
 * Until Task E1: the implementation behind this API is the legacy ChappyChat
 * widget, mounted with its floating launcher hidden and its open state
 * driven from here (ChappyChat takes `hideLauncher`/`open`/`onOpenChange`/
 * `prefill` for exactly this). E1 swaps in the new widget behind the same
 * `useChappy()` API, so callers don't change.
 */
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Same lazy, client-only load the legacy mount uses: the widget is large and
// nothing about it belongs in the first paint.
const ChappyChatWrapper = dynamic(() => import("@/components/ChappyChatWrapper"), { ssr: false });

export interface ChappyApi {
  isOpen: boolean;
  openChappy: (prefill?: string) => void;
  closeChappy: () => void;
}

const ChappyContext = createContext<ChappyApi | null>(null);

export function useChappy(): ChappyApi {
  const ctx = useContext(ChappyContext);
  if (!ctx) throw new Error("useChappy must be used inside <ChappyProvider> (the site shell)");
  return ctx;
}

/**
 * Task D6: the same API, or null where the shell has no Chappy (an embedded
 * page, `?embed=1`, e.g. the business plan's phone demo). Callers hide their
 * "Ask Chappy" when it's null.
 */
export function useOptionalChappy(): ChappyApi | null {
  return useContext(ChappyContext);
}

export function ChappyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  // The widget mounts on first open, not on page load: it fetches history
  // and a guest token as soon as it mounts.
  const [mounted, setMounted] = useState(false);

  const openChappy = useCallback((text?: string) => {
    setPrefill(text);
    setMounted(true);
    setIsOpen(true);
  }, []);

  const closeChappy = useCallback(() => {
    setIsOpen(false);
    setPrefill(undefined);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setIsOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  const api = useMemo(() => ({ isOpen, openChappy, closeChappy }), [isOpen, openChappy, closeChappy]);

  return (
    <ChappyContext.Provider value={api}>
      {children}
      {mounted ? (
        // legacy-ui: the old widget still uses bare button/input/a/h1-h3
        // tags (same scoping as its legacy mount).
        <div className="legacy-ui" data-chappy-legacy>
          <ChappyChatWrapper hideLauncher open={isOpen} onOpenChange={onOpenChange} prefill={prefill} />
        </div>
      ) : null}
    </ChappyContext.Provider>
  );
}
