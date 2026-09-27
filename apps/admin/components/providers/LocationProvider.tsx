"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api";

export type Location = { id: string; name: string; city?: string };
type Ctx = { locations: Location[]; locationId: string; setLocationId: (id: string) => void };
const KEY = "oh-admin-location";
const LocationContext = createContext<Ctx>({ locations: [], locationId: "all", setLocationId: () => {} });

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setId] = useState("all");
  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setId(saved); } catch { /* storage blocked */ }
    api<Location[]>("/locations").then(setLocations).catch(() => setLocations([]));
  }, []);
  useEffect(() => {
    if (locations.length && locationId !== "all" && !locations.some((l) => l.id === locationId)) setId("all");
  }, [locations, locationId]);
  const setLocationId = useCallback((id: string) => {
    setId(id);
    try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
  }, []);
  return <LocationContext.Provider value={{ locations, locationId, setLocationId }}>{children}</LocationContext.Provider>;
}
export const useLocationFilter = () => useContext(LocationContext);
