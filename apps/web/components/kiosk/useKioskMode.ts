"use client";

import { useState, useEffect, useCallback } from "react";

interface KioskModeState {
  isFullscreen: boolean;
  isSupported: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  error: string | null;
}

export function useKioskMode(): KioskModeState {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if fullscreen is supported
  useEffect(() => {
    const elem = document.documentElement as any;
    const supported =
      typeof document !== "undefined" &&
      !!(
        elem.requestFullscreen ||
        elem.webkitRequestFullscreen ||
        elem.webkitRequestFullScreen || // Capital S for older Android
        elem.mozRequestFullScreen ||
        elem.msRequestFullscreen
      );

    console.log("[KioskMode] Fullscreen support check:", {
      supported,
      requestFullscreen: !!elem.requestFullscreen,
      webkitRequestFullscreen: !!elem.webkitRequestFullscreen,
      webkitRequestFullScreen: !!elem.webkitRequestFullScreen,
    });

    setIsSupported(supported);

    // Check initial fullscreen state
    const checkFullscreen = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).webkitCurrentFullScreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;
      const isFs = !!fullscreenElement;
      console.log("[KioskMode] Fullscreen state changed:", isFs);
      setIsFullscreen(isFs);
    };

    checkFullscreen();

    // Listen for fullscreen changes
    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("webkitfullscreenchange", checkFullscreen);
    document.addEventListener("mozfullscreenchange", checkFullscreen);
    document.addEventListener("MSFullscreenChange", checkFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("webkitfullscreenchange", checkFullscreen);
      document.removeEventListener("mozfullscreenchange", checkFullscreen);
      document.removeEventListener("MSFullscreenChange", checkFullscreen);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    setError(null);
    console.log("[KioskMode] Attempting to enter fullscreen...");

    try {
      const elem = document.documentElement as any;

      // Try standard API first
      if (elem.requestFullscreen) {
        console.log("[KioskMode] Using requestFullscreen");
        await elem.requestFullscreen({ navigationUI: "hide" });
      }
      // Webkit with lowercase (newer Chrome/Safari)
      else if (elem.webkitRequestFullscreen) {
        console.log("[KioskMode] Using webkitRequestFullscreen");
        await elem.webkitRequestFullscreen();
      }
      // Webkit with capital S (older Android Chrome)
      else if (elem.webkitRequestFullScreen) {
        console.log("[KioskMode] Using webkitRequestFullScreen (capital S)");
        elem.webkitRequestFullScreen();
      }
      // Firefox
      else if (elem.mozRequestFullScreen) {
        console.log("[KioskMode] Using mozRequestFullScreen");
        await elem.mozRequestFullScreen();
      }
      // IE/Edge
      else if (elem.msRequestFullscreen) {
        console.log("[KioskMode] Using msRequestFullscreen");
        await elem.msRequestFullscreen();
      }
      else {
        throw new Error("No fullscreen API available");
      }

      console.log("[KioskMode] Fullscreen request completed");
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error("[KioskMode] Failed to enter fullscreen:", errorMsg);
      setError(errorMsg);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setError(null);
    console.log("[KioskMode] Attempting to exit fullscreen...");

    try {
      const doc = document as any;

      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.webkitCancelFullScreen) {
        doc.webkitCancelFullScreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }

      console.log("[KioskMode] Exit fullscreen completed");
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error("[KioskMode] Failed to exit fullscreen:", errorMsg);
      setError(errorMsg);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    console.log("[KioskMode] Toggle fullscreen, current state:", isFullscreen);
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    error,
  };
}

// Storage key for kiosk mode preference
const KIOSK_MODE_KEY = "oh_kiosk_mode_enabled";

export function useKioskModePreference(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KIOSK_MODE_KEY);
    setEnabled(stored === "true");
  }, []);

  const setKioskMode = (value: boolean) => {
    localStorage.setItem(KIOSK_MODE_KEY, value ? "true" : "false");
    setEnabled(value);
  };

  return [enabled, setKioskMode];
}
