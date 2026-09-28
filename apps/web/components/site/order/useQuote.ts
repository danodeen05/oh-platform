"use client";

/**
 * The server's price for the draft (POST /orders/quote), debounced and
 * last-request-wins. Every total the flow shows comes from here; the client
 * never adds anything up. The Clerk-authenticated fetch is used so the
 * member's rewards, credits and early access apply.
 */
import { useEffect, useRef, useState } from "react";
import { quote as quoteApi, type OrderApiError, type Quote, type QuoteRequest } from "@/lib/site/orders";
import { SITE_API_URL, type SiteFetch } from "@/lib/site/api";

export type QuoteLine = { menuItemId: string; quantity: number; priceCents: number; selectedValue?: string | null };
export type ServerQuote = Quote & { lines?: QuoteLine[] };

/** `identity` (the member id, or null) re-quotes when the caller signs in or out. */
export function useQuote(request: QuoteRequest | null, api: SiteFetch, identity: string | null = null, delayMs = 250) {
  const [state, setState] = useState<{ quote: ServerQuote | null; error: OrderApiError | null; status: number; loading: boolean }>({
    quote: null,
    error: null,
    status: 0,
    loading: false,
  });
  const seq = useRef(0);
  const key = request ? JSON.stringify([request, identity]) : "";

  useEffect(() => {
    if (!request) {
      setState({ quote: null, error: null, status: 0, loading: false });
      return;
    }
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    let timer: ReturnType<typeof setTimeout>;
    const run = async (attempt: number) => {
      const res = await quoteApi(request, { fetcher: api, baseUrl: SITE_API_URL });
      if (mine !== seq.current) return;
      // Rate limited (or a blip): keep the total loading and ask again shortly, a few times.
      if (!res.ok && (res.status === 429 || res.status === 0) && attempt < 4) {
        timer = setTimeout(() => run(attempt + 1), 3000 * (attempt + 1));
        return;
      }
      setState(res.ok ? { quote: res.data as ServerQuote, error: null, status: res.status, loading: false } : { quote: null, error: res.error, status: res.status, loading: false });
    };
    timer = setTimeout(() => run(0), delayMs);
    return () => clearTimeout(timer);
    // key captures the request by value; api identity changes with Clerk's getToken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
