"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  Guest,
  getGuestFromSession,
  createGuestSession,
  updateGuestDetails,
  clearGuestSession,
  refreshGuestSession,
} from "@/lib/guest-session";

interface GuestContextValue {
  guest: Guest | null;
  isLoading: boolean;
  isGuest: boolean;
  startGuestSession: (data?: { name?: string; phone?: string; email?: string }) => Promise<Guest>;
  updateGuest: (data: { name?: string; phone?: string; email?: string }) => Promise<Guest>;
  endGuestSession: () => void;
  refreshSession: () => Promise<void>;
}

const GuestContext = createContext<GuestContextValue | undefined>(undefined);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load guest session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const existingGuest = await getGuestFromSession();
        setGuest(existingGuest);
      } catch {
        // Session invalid or expired
        setGuest(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const startGuestSession = useCallback(async (data?: { name?: string; phone?: string; email?: string }) => {
    const newGuest = await createGuestSession(data);
    setGuest(newGuest);
    return newGuest;
  }, []);

  const updateGuest = useCallback(async (data: { name?: string; phone?: string; email?: string }) => {
    if (!guest) {
      throw new Error("No active guest session");
    }
    const updatedGuest = await updateGuestDetails(guest.id, data);
    setGuest(updatedGuest);
    return updatedGuest;
  }, [guest]);

  const endGuestSession = useCallback(() => {
    clearGuestSession();
    setGuest(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const refreshedGuest = await refreshGuestSession();
    if (refreshedGuest) {
      setGuest(refreshedGuest);
    }
  }, []);

  return (
    <GuestContext.Provider
      value={{
        guest,
        isLoading,
        isGuest: guest !== null,
        startGuestSession,
        updateGuest,
        endGuestSession,
        refreshSession,
      }}
    >
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error("useGuest must be used within a GuestProvider");
  }
  return context;
}
