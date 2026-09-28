"use client";

/**
 * The status page's data (Task D6): GET /orders/status polled every 10 s
 * (4 s for the demo), the plan demo's stage (pinned in the code, playing by
 * itself, or following the embedding page), the kitchen feed line on each
 * stage change, the pending order link after sign-up, and clearing the
 * shell's active order when the visit is over.
 *
 * Behavior kept from the legacy page: the same routes with the same query
 * strings (plus `locale`), and the demo's postMessage protocol (see
 * lib/site/order-status.ts). The owner's Clerk token and guest session go
 * with the status read (A8b: the owner sees the full view).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteApi, SITE_API_URL } from "@/lib/site/api";
import { groupIdentityHeaders } from "@/lib/site/orders";
import { useGuest } from "@/contexts/guest-context";
import {
  DEMO_DWELL_MS,
  DEMO_NEXT,
  DEMO_READY_MESSAGE,
  FEED_STAGES,
  demoCodeFor,
  demoStageFromMessage,
  initialDemoStage,
  isDemoCode,
  type PhoneStage,
} from "@/lib/site/order-status";

export const TENANT = { "x-tenant-slug": "oh" };

export interface StatusItem {
  id: string;
  name: string | null;
  quantity: number;
  selectedValue: string | null;
  selectedLabel?: string | null;
  priceCents: number;
  categoryType: string | null;
}

export interface StatusOrder {
  id: string;
  orderNumber: string;
  kitchenOrderNumber: string | null;
  orderQrCode: string;
  status: string;
  totalCents: number;
  estimatedArrival: string | null;
  paidAt: string | null;
  arrivedAt: string | null;
  queuedAt: string | null;
  prepStartTime: string | null;
  readyTime: string | null;
  deliveredAt: string | null;
  completedTime: string | null;
  podNumber: string | null;
  podLabel?: string | null;
  podAssignedAt: string | null;
  podConfirmedAt: string | null;
  queuePosition: number | null;
  estimatedWaitMinutes: number | null;
  location: { id: string | null; name: string | null; city: string | null; timezone?: string | null };
  items: StatusItem[];
  guestName: string | null;
}

export interface FeedLine {
  commentary: string | null;
  status?: string;
}

export type LoadState = "loading" | "ready" | "missing" | "error";

export function useOrderStatus({ code, demoStageParam, followParent, locale }: { code: string | null; demoStageParam: string | null; followParent: boolean; locale: string }) {
  const api = useSiteApi();
  const { guest } = useGuest();
  const isDemo = isDemoCode(code);
  const demoFollowsParent = isDemo && followParent;
  const [demoStage, setDemoStage] = useState<PhoneStage>(() => initialDemoStage(code, demoStageParam));
  const orderQrCode = isDemo && code ? demoCodeFor(code, demoStage) : code;

  const [order, setOrder] = useState<StatusOrder | null>(null);
  const [state, setState] = useState<LoadState>(code ? "loading" : "missing");
  const [feed, setFeed] = useState<FeedLine | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const lastFeedStatus = useRef<string | null>(null);
  const codeRef = useRef(orderQrCode);
  codeRef.current = orderQrCode;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  // Refs keep `refresh` stable, so a new Clerk token getter or guest session never restarts the poll.
  const apiRef = useRef(api);
  apiRef.current = api;
  const guestRef = useRef(guest);
  guestRef.current = guest;

  const fetchFeed = useCallback(
    async (qr: string, status: string, lang: string) => {
      if (!FEED_STAGES.includes(status) || lastFeedStatus.current === `${qr}|${status}`) return;
      lastFeedStatus.current = `${qr}|${status}`;
      setFeedLoading(true);
      try {
        const res = await fetch(`${SITE_API_URL}/orders/commentary?orderQrCode=${encodeURIComponent(qr)}&locale=${encodeURIComponent(lang)}`, { headers: TENANT });
        if (res.ok && codeRef.current === qr) setFeed(await res.json());
        else if (!res.ok) lastFeedStatus.current = null;
      } catch {
        lastFeedStatus.current = null;
      } finally {
        setFeedLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const qr = codeRef.current;
    if (!qr) return;
    const lang = localeRef.current;
    try {
      const res = await apiRef.current(`${SITE_API_URL}/orders/status?orderQrCode=${encodeURIComponent(qr)}&locale=${encodeURIComponent(lang)}`, {
        headers: { ...TENANT, ...groupIdentityHeaders(guestRef.current) },
        cache: "no-store",
      });
      if (codeRef.current !== qr) return; // the demo moved on while this was in flight
      if (res.status === 404) {
        setState("missing");
        return;
      }
      if (!res.ok) {
        setState((s) => (s === "ready" ? s : "error"));
        return;
      }
      const data = await res.json();
      const next: StatusOrder | undefined = data?.order;
      if (!next) {
        setState("missing");
        return;
      }
      setOrder((prev) =>
        prev &&
        prev.orderQrCode === next.orderQrCode &&
        prev.status === next.status &&
        prev.podConfirmedAt === next.podConfirmedAt &&
        prev.podNumber === next.podNumber &&
        prev.queuePosition === next.queuePosition &&
        prev.estimatedWaitMinutes === next.estimatedWaitMinutes
          ? prev
          : next,
      );
      setState("ready");
      fetchFeed(qr, next.status, lang);
      // The visit is over: the shell's active-order pill lets go of it (never for the demo,
      // which shares the site's storage with a guest's real order).
      if (next.status === "COMPLETED" && !isDemoCode(qr)) {
        try {
          if (localStorage.getItem("activeOrderQrCode") === next.orderQrCode) localStorage.removeItem("activeOrderQrCode");
        } catch {
          /* storage blocked */
        }
      }
    } catch {
      setState((s) => (s === "ready" ? s : "error"));
    }
  }, [fetchFeed]);

  // First load, and again whenever the demo's stage (and so its code) changes.
  useEffect(() => {
    if (!orderQrCode) return;
    void refresh();
  }, [orderQrCode, refresh]);

  // Poll: 10 s for a real order, 4 s for the demo.
  useEffect(() => {
    if (!orderQrCode) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, isDemo ? 4000 : 10_000);
    return () => clearInterval(id);
  }, [orderQrCode, isDemo, refresh]);

  // Demo: play the stages by itself, unless the embedding page drives them.
  useEffect(() => {
    if (!isDemo || demoFollowsParent) return;
    const next = DEMO_NEXT[demoStage];
    if (!next) return;
    const t = setTimeout(() => setDemoStage(next), DEMO_DWELL_MS[demoStage]);
    return () => clearTimeout(t);
  }, [isDemo, demoFollowsParent, demoStage]);

  // Demo: follow the embedding page ({ type: "oh-status-demo", stage }), same origin only.
  useEffect(() => {
    if (!demoFollowsParent) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const stage = demoStageFromMessage(e.data);
      if (stage) setDemoStage(stage);
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: DEMO_READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [demoFollowsParent]);

  return { order, state, isDemo, demoStage, setDemoStage, orderQrCode, feed, feedLoading, refresh };
}

/** POST /orders/link-to-account once the guest who tapped "Create an account" comes back signed in. */
export function usePendingOrderLink({ orderQrCode, signedIn, email, name, onLinked }: { orderQrCode: string | null; signedIn: boolean; email: string | null; name: string | null; onLinked: () => void }) {
  const api = useSiteApi();
  const done = useRef(false);
  useEffect(() => {
    if (!signedIn || !orderQrCode || done.current) return;
    let pending: { orderQrCode?: string } | null = null;
    try {
      pending = JSON.parse(localStorage.getItem("pendingOrderLink") || "null");
    } catch {
      pending = null;
    }
    if (!pending || pending.orderQrCode !== orderQrCode) return;
    done.current = true;
    (async () => {
      try {
        // Make sure the member row exists (POST /users is the sign-up upsert), then link. The API takes the account from the session.
        if (email) {
          await api(`${SITE_API_URL}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name: name || undefined }) });
        }
        const res = await api(`${SITE_API_URL}/orders/link-to-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...TENANT },
          body: JSON.stringify({ orderQrCode }),
        });
        if (res.ok) {
          localStorage.removeItem("pendingOrderLink");
          onLinked();
        }
      } catch {
        done.current = false;
      }
    })();
  }, [signedIn, orderQrCode, email, name, api, onLinked]);
}
