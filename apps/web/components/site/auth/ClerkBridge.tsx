"use client";

/**
 * The lazily loaded half of DeferredClerk (Task G2a): Clerk's real
 * <ClerkProvider> (which also loads clerk-js from Clerk's CDN) around a
 * component that reports Clerk's state upward. It renders nothing visible
 * and wraps none of the page, so mounting it never remounts anything.
 */
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { enUS } from "@clerk/localizations/en-US";
import { esES } from "@clerk/localizations/es-ES";
import { zhCN } from "@clerk/localizations/zh-CN";
import { zhTW } from "@clerk/localizations/zh-TW";
import { useEffect } from "react";
import { clerkModalProps, type ModalOptions } from "@/lib/site/auth";

export interface ClerkSnapshot {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | undefined;
  name: string | undefined;
  firstName: string | undefined;
  getToken: () => Promise<string | null>;
  openSignIn: (opts?: ModalOptions) => void;
  openSignUp: (opts?: ModalOptions) => void;
}

// Same map as lib/clerk-localization.ts (the server side's).
const LOCALIZATIONS: Record<string, typeof enUS> = { en: enUS, "zh-TW": zhTW, "zh-CN": zhCN, es: esES };

export function ClerkBridge({ locale, onSnapshot }: { locale: string; onSnapshot: (s: ClerkSnapshot) => void }) {
  return (
    <ClerkProvider localization={LOCALIZATIONS[locale] ?? enUS}>
      <Publisher onSnapshot={onSnapshot} />
    </ClerkProvider>
  );
}

function Publisher({ onSnapshot }: { onSnapshot: (s: ClerkSnapshot) => void }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || user?.firstName || undefined;

  useEffect(() => {
    onSnapshot({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userId: userId ?? null,
      email,
      name,
      firstName: user?.firstName || undefined,
      getToken: async () => (await getToken()) ?? null,
      openSignIn: (opts) => clerk.openSignIn(clerkModalProps("signIn", opts)),
      openSignUp: (opts) => clerk.openSignUp(clerkModalProps("signUp", opts)),
    });
  }, [onSnapshot, isLoaded, isSignedIn, userId, email, name, user?.firstName, getToken, clerk]);

  return null;
}
