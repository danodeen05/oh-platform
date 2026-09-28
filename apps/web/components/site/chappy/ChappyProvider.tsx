"use client";

/**
 * One Chappy for the whole customer site (Task E1). The dock, the desktop
 * nav, the legacy pages' floating launcher and any "Ask Chappy" link open
 * the chat through `useChappy().openChappy(prefill?)`; the API is the one C4
 * introduced, so callers didn't change.
 *
 * The widget itself (ChappyWidget: the stream client, the sheet and panel,
 * framer-motion) is a separate chunk loaded on the first open, never in the
 * first paint, and stays mounted after that so the conversation and a turn
 * in flight survive closing and reopening.
 *
 * Task E2: a pay card whose payment method left the page (a Stripe
 * redirect) comes back here with ?chappyPay=. The provider strips those
 * parameters from the address bar, opens Chappy and hands the return to
 * the widget, which verifies it with the API (cards/pay-return.ts).
 */
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readChappyReturn, type ChappyPayReturn } from "./cards/pay-return";

const ChappyWidget = dynamic(() => import("./ChappyWidget"), { ssr: false });

export interface ChappyApi {
  isOpen: boolean;
  openChappy: (prefill?: string) => void;
  closeChappy: () => void;
}

const ChappyContext = createContext<ChappyApi | null>(null);

/**
 * Outside a provider (an `?embed=1` page, where the shell drops its chrome
 * and Chappy with it) an "Ask Chappy" link must not crash the page: it gets
 * a closed Chappy whose open does nothing.
 */
const NO_CHAPPY: ChappyApi = Object.freeze({ isOpen: false, openChappy: () => {}, closeChappy: () => {} });

export function useChappy(): ChappyApi {
  return useContext(ChappyContext) ?? NO_CHAPPY;
}

export function ChappyProvider({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefill, setPrefill] = useState<{ text?: string; key: number }>({ key: 0 });
  const [resume, setResume] = useState<ChappyPayReturn | null>(null);

  // Back from a Stripe redirect that a Chappy pay card started.
  useEffect(() => {
    const found = readChappyReturn(window.location.href);
    if (!found) return;
    window.history.replaceState(window.history.state, "", found.cleanUrl);
    setResume(found.ret);
    setMounted(true);
    setIsOpen(true);
  }, []);

  const openChappy = useCallback((text?: string) => {
    // A click handler may pass its event; only a string is a prefill.
    setPrefill((p) => ({ text: typeof text === "string" && text.trim() ? text : undefined, key: p.key + 1 }));
    setMounted(true);
    setIsOpen(true);
  }, []);

  const closeChappy = useCallback(() => setIsOpen(false), []);
  const reopen = useCallback(() => setIsOpen(true), []);

  const api = useMemo(() => ({ isOpen, openChappy, closeChappy }), [isOpen, openChappy, closeChappy]);

  return (
    <ChappyContext.Provider value={api}>
      {children}
      {mounted ? <ChappyWidget open={isOpen} onClose={closeChappy} onOpen={reopen} prefill={prefill.text} prefillKey={prefill.key} resume={resume} /> : null}
    </ChappyContext.Provider>
  );
}
