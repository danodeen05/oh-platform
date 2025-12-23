"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN", "es"];
const SESSION_KEY = "oh_language_tracked";

/**
 * Tracks the user's browser language preference for analytics.
 * Sends data once per session to avoid duplicate tracking.
 */
export default function LanguageTracker() {
  const currentLocale = useLocale();

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

  return null; // This component renders nothing
}
