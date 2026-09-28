"use client";

/**
 * Seat data for CombMap (Task D4a). `CombMap` itself is pure presentation and
 * takes `seats` as a prop; this hook is the one place that talks to
 * `GET /locations/:id/seats` (Task A8 shape):
 *
 *   { layoutKey, layoutMirror, seats: [{ id, label, finger, rowSide, position,
 *     status, podType, dualPartnerId, bestRank, orders? }] }
 *
 * The endpoint also returns each seat's active order (with the guest's name)
 * for the admin and kiosk screens. None of that is kept here: `toCombSeats`
 * copies only what the map draws, so order details never sit in customer
 * page state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatStatus } from "./PodCell";

export type CombLayoutKey = "comb-75" | "comb-70-mirrored";

export interface ApiSeat {
  id: string;
  label: string;
  finger?: number;
  rowSide?: string;
  position?: number;
  status: string;
  podType: string;
  dualPartnerId?: string | null;
  bestRank?: number | null;
  orders?: unknown[];
}

export interface SeatsResponse {
  layoutKey: string | null;
  layoutMirror?: boolean;
  seats: ApiSeat[];
}

/** What CombMap draws (plus `id` and `bestRank`, which the order flow needs to book). */
export interface MapSeat {
  id: string;
  label: string;
  status: SeatStatus;
  podType: "SINGLE" | "DUAL";
  dualPartnerLabel?: string;
  bestRank?: number;
}

const STATUSES = new Set<SeatStatus>(["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING"]);
const LAYOUT_KEYS = new Set<CombLayoutKey>(["comb-75", "comb-70-mirrored"]);

export function layoutKeyOf(data: unknown): CombLayoutKey | null {
  const key = data && typeof data === "object" ? (data as { layoutKey?: unknown }).layoutKey : null;
  return typeof key === "string" && LAYOUT_KEYS.has(key as CombLayoutKey) ? (key as CombLayoutKey) : null;
}

/** API seats to map seats. An unrecognized status is shown as occupied: never offer a pod we can't vouch for. */
export function toCombSeats(data: SeatsResponse | null | undefined): MapSeat[] {
  const seats = Array.isArray(data?.seats) ? data.seats : [];
  const labelById = new Map(seats.map((s) => [s.id, s.label]));
  return seats
    .filter((s) => typeof s.label === "string" && s.label.length > 0)
    .map((s) => ({
      id: s.id,
      label: s.label,
      status: STATUSES.has(s.status as SeatStatus) ? (s.status as SeatStatus) : "OCCUPIED",
      podType: s.podType === "DUAL" ? "DUAL" : "SINGLE",
      dualPartnerLabel: s.dualPartnerId ? labelById.get(s.dualPartnerId) : undefined,
      bestRank: typeof s.bestRank === "number" ? s.bestRank : undefined,
    }));
}

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseSeatsResult {
  layoutKey: CombLayoutKey | null;
  seats: MapSeat[];
  status: "idle" | "loading" | "ready" | "error";
  refresh: () => void;
}

/**
 * Live seats for a location. Polls every `refreshMs` (default 15 s) while the
 * tab is visible; pass 0 to fetch once. A failed poll keeps the last good data.
 */
export function useSeats(locationId: string | null | undefined, { refreshMs = 15_000, apiBase = DEFAULT_API }: { refreshMs?: number; apiBase?: string } = {}): UseSeatsResult {
  const [state, setState] = useState<Omit<UseSeatsResult, "refresh">>({ layoutKey: null, seats: [], status: locationId ? "loading" : "idle" });
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const res = await fetch(`${apiBase}/locations/${encodeURIComponent(locationId)}/seats`, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`seats ${res.status}`);
      const json = (await res.json()) as SeatsResponse;
      if (ctrl.signal.aborted) return;
      setState({ layoutKey: layoutKeyOf(json), seats: toCombSeats(json), status: "ready" });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setState((s) => ({ ...s, status: s.seats.length ? s.status : "error" }));
    }
  }, [locationId, apiBase]);

  useEffect(() => {
    if (!locationId) {
      setState({ layoutKey: null, seats: [], status: "idle" });
      return;
    }
    setState((s) => ({ ...s, status: s.seats.length ? s.status : "loading" }));
    void load();
    if (!refreshMs) return () => inflight.current?.abort();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    }, refreshMs);
    return () => {
      clearInterval(timer);
      inflight.current?.abort();
    };
  }, [locationId, refreshMs, load]);

  return { ...state, refresh: () => void load() };
}
