"use client";

import { useEffect, useState } from "react";

/**
 * Demo mode for the kiosk embedded in the business plan: the guest orders and
 * "pays" exactly as on the real kiosk, but no order is created, no card reader
 * is contacted and nothing reaches a kitchen. On with ?demo=1, remembered for
 * the tab (like ?fit=1) so the order flow keeps it after the welcome screen.
 */
export function useKioskDemo(): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("demo") === "1") {
        sessionStorage.setItem("kioskDemo", "1");
      }
      setDemo(sessionStorage.getItem("kioskDemo") === "1");
    } catch {
      setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
    }
  }, []);
  return demo;
}
