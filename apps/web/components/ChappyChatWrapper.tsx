"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { ChappyChat } from "./ChappyChat";
import { useEffect, useState } from "react";

export function ChappyChatWrapper() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  // Get or create guest/session ID for non-logged-in users
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Check for existing guest ID in localStorage
      let storedGuestId = localStorage.getItem("oh-guest-id");
      if (!storedGuestId) {
        // Check if there's a session ID from a previous order
        storedGuestId = localStorage.getItem("oh-session-id");
      }

      if (storedGuestId) {
        setGuestId(storedGuestId);
      } else {
        // Generate a session ID for anonymous users
        const newSessionId = `chappy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setSessionId(newSessionId);
      }
      setDbUserId(null);
    }
  }, [isLoaded, isSignedIn]);

  // Fetch database user ID when logged in (maps Clerk ID to DB ID)
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      const apiUrl = getApiUrl();

      // Fetch user by email to get database ID
      fetch(`${apiUrl}/users/by-email/${encodeURIComponent(email)}`)
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
      guestId={guestId || undefined}
      sessionId={sessionId || undefined}
      apiUrl={apiUrl}
    />
  );
}

export default ChappyChatWrapper;
