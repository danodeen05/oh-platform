"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useMemberId, useSiteApi, SITE_API_URL } from "@/lib/site/api";

const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN", "es"];
const SESSION_KEY = "oh_language_tracked";

/**
 * Tracks the user's browser language preference for analytics, and (Task F2)
 * saves a signed-in member's preferred locale to their account when it
 * differs from what's on file, so localized texts (order confirmations,
 * tier-up, credit-expiry) reach them in the language they're actually using.
 */
export default function LanguageTracker() {
  const currentLocale = useLocale();
  const member = useMemberId();
  const api = useSiteApi();
  const lastSyncedLocale = useRef<string | null>(null);

  useEffect(() => {
    // Only track once per session
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const trackLanguage = async () => {
      try {
        // Get browser language info
        const browserLanguage = navigator.language || navigator.languages?.[0] || "en";
        const allLanguages = navigator.languages?.join(",") || browserLanguage;

        // Extract primary language code (e.g., "zh-TW" from "zh-TW,zh;q=0.9,en;q=0.8")
        const primaryLanguage = browserLanguage;

        // Check if the primary language is supported
        const wasSupported = SUPPORTED_LOCALES.some(
          (locale) =>
            primaryLanguage === locale ||
            primaryLanguage.startsWith(locale.split("-")[0])
        );

        // Generate or retrieve session ID
        let sessionId = sessionStorage.getItem("oh_session_id");
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem("oh_session_id", sessionId);
        }

        // Send to API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        await fetch(`${apiUrl}/analytics/language`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            browserLanguage: allLanguages,
            primaryLanguage,
            resolvedLocale: currentLocale,
            wasSupported,
            sessionId,
          }),
        });

        // Mark as tracked for this session
        sessionStorage.setItem(SESSION_KEY, "true");
      } catch (error) {
        // Silently fail - analytics should not break the app
        console.debug("Language tracking failed:", error);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(trackLanguage, 1000);
    return () => clearTimeout(timer);
  }, [currentLocale]);

  // Task F2: PATCH /users/:id { locale } when a signed-in member's saved
  // locale differs from the one they're currently viewing the site in.
  // Skips entirely for guests/anonymous visitors (no account to save it on).
  useEffect(() => {
    if (!member.ready || !member.signedIn || !member.userId) return;
    if (!SUPPORTED_LOCALES.includes(currentLocale)) return;
    if (lastSyncedLocale.current === currentLocale) return; // already synced this locale this session

    let cancelled = false;
    (async () => {
      try {
        const me = await api(`${SITE_API_URL}/users/me`);
        if (cancelled || !me.ok) return;
        const { locale } = await me.json();
        if (cancelled) return; // Task F2 fix round 1: never mark a cancelled attempt as synced,
        // or switching back to `currentLocale` later would wrongly skip the retry.
        if (locale === currentLocale) {
          lastSyncedLocale.current = currentLocale;
          return;
        }
        const res = await api(`${SITE_API_URL}/users/${member.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: currentLocale }),
        });
        if (!cancelled && res.ok) lastSyncedLocale.current = currentLocale;
      } catch (error) {
        // Silently fail - locale sync should never break the app.
        console.debug("Locale sync failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member.ready, member.signedIn, member.userId, currentLocale, api]);

  return null; // This component renders nothing
}
