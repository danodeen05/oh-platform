"use client";

/**
 * Publishes Clerk's own hooks as SiteAuth (lib/site/auth.tsx) for pages that
 * render inside Clerk's <ClerkProvider>: the legacy pages, agents and
 * kiosk-unauthorized (LegacyChrome). Shared code such as lib/site/api.ts and
 * the old Chappy widget reads identity through useSiteAuth() on both legacy
 * and rebuilt pages.
 */
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useMemo, type ReactNode } from "react";
import { SiteAuthContext, type SiteAuth } from "@/lib/site/auth";

export function ClerkSiteAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || user?.firstName || undefined;

  const value = useMemo<SiteAuth>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userId: userId ?? null,
      email,
      name,
      getToken: async () => (await getToken()) ?? null,
      openSignIn: () => clerk.openSignIn(),
      openSignUp: () => clerk.openSignUp(),
      preload: () => {},
    }),
    [isLoaded, isSignedIn, userId, email, name, getToken, clerk],
  );

  return <SiteAuthContext.Provider value={value}>{children}</SiteAuthContext.Provider>;
}
