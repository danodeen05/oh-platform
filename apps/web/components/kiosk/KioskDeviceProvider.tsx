"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { API_URL } from "@/lib/api";

interface KioskLocation {
  id: string;
  name: string;
  city: string;
  address: string;
  taxRate: number;
  timezone: string;
}

interface KioskDevice {
  id: string;
  name: string;
}

interface KioskDeviceContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  device: KioskDevice | null;
  location: KioskLocation | null;
  error: string | null;
  authenticate: (apiKey: string) => Promise<boolean>;
  clearAuth: () => void;
}

const KioskDeviceContext = createContext<KioskDeviceContextValue | null>(null);

const STORAGE_KEY = "oh_kiosk_api_key";
const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export function KioskDeviceProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [device, setDevice] = useState<KioskDevice | null>(null);
  const [location, setLocation] = useState<KioskLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Authenticate with the API
  async function authenticate(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/kiosk/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          appVersion: "1.0.0",
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        setIsAuthenticated(false);
        return false;
      }

      const data = await res.json();
      setDevice(data.device);
      setLocation(data.location);
      setIsAuthenticated(true);
      setError(null);

      // Store API key on successful auth
      localStorage.setItem(STORAGE_KEY, apiKey);

      return true;
    } catch (err) {
      console.error("Kiosk auth error:", err);
      setError("Connection error");
      setIsAuthenticated(false);
      return false;
    }
  }

  // Clear authentication
  function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    setDevice(null);
    setLocation(null);
    setError(null);
  }

  // Send heartbeat
  async function sendHeartbeat() {
    const apiKey = localStorage.getItem(STORAGE_KEY);
    if (!apiKey) return;

    try {
      await fetch(`${API_URL}/kiosk/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          appVersion: "1.0.0",
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        }),
      });
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  }

  // Check for stored API key on mount
  useEffect(() => {
    async function checkStoredAuth() {
      const storedKey = localStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        await authenticate(storedKey);
      }
      setIsLoading(false);
    }

    checkStoredAuth();
  }, []);

  // Heartbeat interval when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <KioskDeviceContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        device,
        location,
        error,
        authenticate,
        clearAuth,
      }}
    >
      {children}
    </KioskDeviceContext.Provider>
  );
}

export function useKioskDevice() {
  const context = useContext(KioskDeviceContext);
  if (!context) {
    throw new Error("useKioskDevice must be used within KioskDeviceProvider");
  }
  return context;
}

// Hook to check if device auth is available (has stored key)
export function useHasDeviceAuth(): boolean {
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    setHasAuth(!!localStorage.getItem(STORAGE_KEY));
  }, []);

  return hasAuth;
}
