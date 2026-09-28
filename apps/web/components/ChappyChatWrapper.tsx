"use client";

import { useUser } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { ChappyChat } from "./ChappyChat";
import { useSiteApi } from "@/lib/site/api";
import { useCallback, useEffect, useState } from "react";

// Guests chat with a SIGNED token from POST /chappy/guest-token (the API no
// longer accepts a raw guest or session id). Kept until Task E1 replaces this widget.
const GUEST_TOKEN_KEY = "oh-chappy-guest-token";

export function ChappyChatWrapper() {
  const { user, isLoaded, isSignedIn } = useUser();
  const locale = useLocale();
  const api = useSiteApi();
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  const fetchGuestToken = useCallback(async (apiBase: string) => {
    try {
      const res = await fetch(`${apiBase}/chappy/guest-token`, { method: "POST" });
      const token = res.ok ? (await res.json())?.token : null;
      if (typeof token === "string" && token) {
        try {
          localStorage.setItem(GUEST_TOKEN_KEY, token);
        } catch {
          /* storage unavailable: keep it in memory */
        }
        setGuestToken(token);
      }
    } catch {
      setGuestToken(null);
    }
  }, []);

  // Get or create a signed guest token for non-logged-in users
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(GUEST_TOKEN_KEY);
      } catch {
        stored = null;
      }
      if (stored) setGuestToken(stored);
      else fetchGuestToken(getApiUrl());
      setDbUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // The API refused the stored token (expired or rotated secret): get a fresh one.
  const onGuestTokenRejected = useCallback(() => {
    try {
      localStorage.removeItem(GUEST_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setGuestToken(null);
    fetchGuestToken(getApiUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGuestToken]);

  // Fetch database user ID when logged in (maps Clerk ID to DB ID)
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      const apiUrl = getApiUrl();

      // Fetch user by email to get database ID
      // Only the caller's own email resolves (the API checks the Bearer token).
      api(`${apiUrl}/users/by-email/${encodeURIComponent(email)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.id) {
            setDbUserId(data.id);
          }
        })
        .catch(() => {
          // User might not exist in DB yet, that's okay
          setDbUserId(null);
        });
    }
  }, [isLoaded, isSignedIn, user?.primaryEmailAddress?.emailAddress]);

  // Get API URL - must use HTTPS API for HTTPS sites (mixed content blocking)
  const getApiUrl = () => {
    if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL || "";

    const hostname = window.location.hostname;
    const isHttps = window.location.protocol === "https:";

    // For HTTPS sites (like devwebapp.ohbeef.com), must use HTTPS API
    if (isHttps) {
      // devwebapp uses devapi proxy which routes to localhost:4000
      if (hostname.includes("devwebapp")) {
        return "https://devapi.ohbeef.com";
      }
      return process.env.NEXT_PUBLIC_API_URL || "";
    }

    // For localhost HTTP, use local API
    if (hostname === "localhost" || hostname.includes("127.0.0.1")) {
      return "http://localhost:4000";
    }

    return process.env.NEXT_PUBLIC_API_URL || "";
  };
  const apiUrl = getApiUrl();

  // Don't render until we know auth state
  if (!isLoaded) {
    return null;
  }

  return (
    <ChappyChat
      userId={isSignedIn && dbUserId ? dbUserId : undefined}
      guestToken={!isSignedIn && guestToken ? guestToken : undefined}
      onGuestTokenRejected={onGuestTokenRejected}
      locale={locale}
      apiUrl={apiUrl}
    />
  );
}

export default ChappyChatWrapper;
