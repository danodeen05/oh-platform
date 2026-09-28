"use client";

/**
 * SiteAuth for (site) pages without Clerk on the critical path (Task G2a).
 *
 * Clerk's React code is about 57 KB gzipped of first-party JS, and its
 * provider starts downloading clerk-js (hundreds of KB from Clerk's CDN)
 * during the first load, competing with the page's own image and scripts on
 * a phone connection. Here the page renders and hydrates from the server's
 * answer instead (`initialSignedIn`, read from the verified session in the
 * (site) layout), and ClerkBridge, which holds the real <ClerkProvider>,
 * loads:
 *
 * - right away for a signed-in visitor (their page asks for tokens);
 * - otherwise once the page has loaded and the browser is idle;
 * - or earlier, the moment something needs it: getToken(), the sign-in or
 *   sign-up modal, or preload() on intent (hover or touch of the button).
 *
 * The bridge renders no UI and wraps nothing, so loading it never remounts
 * the page. Until Clerk answers, a signed-out visitor is known (isLoaded)
 * and a signed-in one waits (isLoaded false), the same contract as Clerk's
 * own hooks.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SiteAuthContext, type SiteAuth } from "@/lib/site/auth";
import type { ClerkSnapshot } from "./ClerkBridge";

const ClerkBridge = dynamic(() => import("./ClerkBridge").then((m) => m.ClerkBridge), { ssr: false });

export function DeferredClerk({
  initialSignedIn,
  locale,
  children,
}: {
  initialSignedIn: boolean;
  locale: string;
  children: ReactNode;
}) {
  const [load, setLoad] = useState(false);
  const [snap, setSnap] = useState<ClerkSnapshot | null>(null);
  const snapRef = useRef<ClerkSnapshot | null>(null);
  const waiters = useRef<Array<(s: ClerkSnapshot) => void>>([]);
  const signedInRef = useRef(initialSignedIn);
  signedInRef.current = initialSignedIn;

  const onSnapshot = useCallback((s: ClerkSnapshot) => {
    snapRef.current = s;
    setSnap(s);
    if (s.isLoaded) {
      const pending = waiters.current;
      waiters.current = [];
      for (const resolve of pending) resolve(s);
    }
  }, []);

  useEffect(() => {
    if (initialSignedIn) {
      setLoad(true);
      return;
    }
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => setLoad(true), { timeout: 3000 });
      } else {
        timer = setTimeout(() => setLoad(true), 200);
      }
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [initialSignedIn]);

  const ready = useCallback((): Promise<ClerkSnapshot> => {
    const current = snapRef.current;
    if (current?.isLoaded) return Promise.resolve(current);
    setLoad(true);
    return new Promise((resolve) => waiters.current.push(resolve));
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const current = snapRef.current;
    if (current?.isLoaded) return current.getToken();
    // Signed out per the server and Clerk not loaded yet: there is no token.
    if (!signedInRef.current) return null;
    return (await ready()).getToken();
  }, [ready]);
  const openSignIn = useCallback(() => void ready().then((s) => s.openSignIn()), [ready]);
  const openSignUp = useCallback(() => void ready().then((s) => s.openSignUp()), [ready]);
  const preload = useCallback(() => setLoad(true), []);

  const value = useMemo<SiteAuth>(() => {
    const loaded = Boolean(snap?.isLoaded);
    return {
      isLoaded: loaded || !initialSignedIn,
      isSignedIn: loaded ? Boolean(snap?.isSignedIn) : initialSignedIn,
      userId: snap?.userId ?? null,
      email: snap?.email,
      name: snap?.name,
      getToken,
      openSignIn,
      openSignUp,
      preload,
    };
  }, [snap, initialSignedIn, getToken, openSignIn, openSignUp, preload]);

  return (
    <SiteAuthContext.Provider value={value}>
      {children}
      {load ? <ClerkBridge locale={locale} onSnapshot={onSnapshot} /> : null}
    </SiteAuthContext.Provider>
  );
}
