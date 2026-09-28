/**
 * Clerk's server-rendered <ClerkProvider>, localized, for the surfaces that
 * still load Clerk up front: legacy pages (LegacyChrome), kiosk and CNY.
 *
 * Task G2a moved it here from app/[locale]/layout.tsx. A layout that merely
 * imports ClerkProvider puts Clerk's client code into the JS of every page
 * below it, including the rebuilt (site) pages, which now load Clerk after
 * first paint instead (components/site/auth/DeferredClerk.tsx).
 */
import { ClerkProvider } from "@clerk/nextjs";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { clerkLocalizationFor } from "@/lib/clerk-localization";

export async function WithClerk({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return <ClerkProvider localization={clerkLocalizationFor(locale)}>{children}</ClerkProvider>;
}
