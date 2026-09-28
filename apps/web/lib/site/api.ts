"use client";

/**
 * Authenticated fetch for the customer site.
 *
 * The API derives the caller from a verified Clerk session token
 * (packages/api/src/auth/customer.js), never from a client-sent user id, so
 * member-scoped calls (/users/:id/*, /users/me, POST /users, /orders/link-to-account,
 * /orders/:id/apply-credits, /chappy/*) must carry `Authorization: Bearer <token>`.
 * Same idea as the admin app's ApiAuthInit, but explicit rather than a global
 * window.fetch patch: only call sites that need identity use it.
 *
 * getToken waits for Clerk to finish loading, so this is safe to call from a
 * mount effect. Identity comes from useSiteAuth() (lib/site/auth.tsx), not
 * Clerk's hooks directly, so (site) pages can load Clerk after first paint
 * (Task G2a).
 */

import { useCallback, useEffect, useState } from "react";
import { claimPendingReferral } from "./referral";
import { useSiteAuth } from "./auth";

export const SITE_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** One referral claim per page load, across every useMemberId() on the page. */
let referralClaimStarted = false;

export type TokenGetter = () => Promise<string | null | undefined>;
export type SiteFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** fetch() with the Clerk session token attached (when there is one). An explicit Authorization header wins. */
export async function authedFetch(getToken: TokenGetter, input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    let token: string | null | undefined = null;
    try {
      token = await getToken();
    } catch {
      token = null; // signed out or Clerk unavailable: the API treats the call as anonymous
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/** Hook form: `const api = useSiteApi(); await api(`${SITE_API_URL}/users/${id}/profile`)`. */
export function useSiteApi(): SiteFetch {
  const { getToken } = useSiteAuth();
  return useCallback((input: string, init?: RequestInit) => authedFetch(() => getToken(), input, init), [getToken]);
}

/**
 * The signed-in member's database id, from the verified session (GET /users/me),
 * creating the row with POST /users on first visit. Replaces trusting
 * localStorage "userId", which can be stale or belong to another account.
 * The id is still mirrored to localStorage for older pages that read it.
 */
export function useMemberId(): { userId: string | null; ready: boolean; signedIn: boolean } {
  const { isLoaded, isSignedIn, userId: clerkUserId, email, name } = useSiteAuth();
  const api = useSiteApi();
  const [state, setState] = useState<{ userId: string | null; ready: boolean }>({ userId: null, ready: false });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setState({ userId: null, ready: true });
      return;
    }
    let cancelled = false;
    (async () => {
      let id: string | null = null;
      try {
        const me = await api(`${SITE_API_URL}/users/me`);
        if (me.ok) {
          id = (await me.json())?.id ?? null;
        } else if (me.status === 404 && email) {
          const created = await api(`${SITE_API_URL}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name }),
          });
          if (created.ok) id = (await created.json())?.id ?? null;
        }
      } catch {
        id = null;
      }
      // Task D5 fix round 1: a saved `?ref=` code is sent once the member is known (lib/site/referral.ts).
      if (id && email && !referralClaimStarted) {
        referralClaimStarted = true;
        let storage: Storage | null = null;
        try {
          storage = localStorage;
        } catch {
          storage = null;
        }
        const claim = await claimPendingReferral(api, SITE_API_URL, { email, name }, storage);
        if (claim === "failed") referralClaimStarted = false;
      }
      if (cancelled) return;
      try {
        if (id) localStorage.setItem("userId", id);
        else localStorage.removeItem("userId");
      } catch {
        /* storage unavailable */
      }
      setState({ userId: id, ready: true });
    })();
    return () => {
      cancelled = true;
    };
    // api changes identity with getToken; the session (user id) is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, clerkUserId, email]);

  return { ...state, signedIn: Boolean(isSignedIn) };
}
