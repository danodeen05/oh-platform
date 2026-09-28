"use client";

/**
 * The customer site's view of the signed-in member (Task G2a).
 *
 * Components read identity through `useSiteAuth()` instead of Clerk's hooks,
 * so a page doesn't need Clerk's React code (about 57 KB gzipped, plus the
 * clerk-js script it loads from Clerk's CDN) to render and hydrate:
 *
 * - (site) pages: DeferredClerk (components/site/auth/DeferredClerk.tsx)
 *   starts from the server's answer (signed in or not, from the verified
 *   session cookie) and loads Clerk after the page has loaded, or as soon as
 *   something needs it (a token, the sign-in modal, a hover on the account
 *   button).
 * - legacy pages keep Clerk's own <ClerkProvider>; ClerkSiteAuth
 *   (components/legacy/ClerkSiteAuth.tsx) republishes its hooks here, so
 *   shared code (lib/site/api.ts, the old Chappy widget) works in both.
 */
import { createContext, useContext } from "react";

export interface SiteAuth {
  /** False until the session is known (a signed-in visitor waits for Clerk). */
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Clerk user id, once Clerk has loaded. */
  userId: string | null;
  email: string | undefined;
  name: string | undefined;
  /** The Clerk session token (null when signed out). Waits for Clerk when needed. */
  getToken: () => Promise<string | null>;
  /** Clerk's sign-in and sign-up modals. */
  openSignIn: () => void;
  openSignUp: () => void;
  /** Starts loading Clerk early (on intent). A no-op where it's already loaded. */
  preload: () => void;
  /** A sign-in or sign-up modal was asked for and is waiting for Clerk to load. */
  pending?: boolean;
}

export const SiteAuthContext = createContext<SiteAuth | null>(null);

export function useSiteAuth(): SiteAuth {
  const auth = useContext(SiteAuthContext);
  if (!auth) throw new Error("useSiteAuth: no SiteAuth provider (DeferredClerk on (site) pages, ClerkSiteAuth under LegacyChrome)");
  return auth;
}
