"use client";

import { useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Attaches an Authorization: Bearer <clerk-session-token> header to every
 * request the admin dashboard makes to the API origin.
 *
 * The API guards all /admin/* routes (packages/api/src/index.js) and expects
 * admin-dashboard calls to carry a Bearer token. The many fetch() call sites
 * in this app don't add one individually, so we wrap window.fetch once here
 * rather than threading a token through ~20 components. Only requests to the
 * configured API base are touched; Clerk's own and same-origin requests are
 * left untouched. Falls back to a static token when no Clerk session exists
 * (e.g. local dev, where the API skips auth anyway).
 */
export default function ApiAuthInit() {
  useEffect(() => {
    if (!API_BASE || typeof window === "undefined") return;
    const orig = window.fetch.bind(window);
    if ((window.fetch as any).__ohWrapped) return;

    const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : (input as Request).url;

        if (url && url.startsWith(API_BASE)) {
          let token: string | null = null;
          try {
            token = await (window as any).Clerk?.session?.getToken?.();
          } catch {
            /* no active session */
          }
          const headers = new Headers(
            init?.headers ||
              (input instanceof Request ? input.headers : undefined)
          );
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token || "admin-dashboard"}`);
          }
          init = { ...init, headers };
        }
      } catch {
        /* never block a request because of auth wiring */
      }
      return orig(input as any, init);
    };

    (wrapped as any).__ohWrapped = true;
    window.fetch = wrapped as typeof window.fetch;

    return () => {
      window.fetch = orig;
    };
  }, []);

  return null;
}
