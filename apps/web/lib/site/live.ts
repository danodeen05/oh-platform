/**
 * Task D1: live location status for the customer site (the home story's
 * hero pill and its two location cards).
 *
 * `useLiveStatus(locationId)` polls the public `GET /locations/:id/availability`
 * every 60 seconds and pauses while the tab is hidden. Since A8b that
 * response is status-only for the public: `isOpen`, `closesAt` (the API's
 * display string, e.g. "9pm" or "8:45pm") and the seat list with each
 * seat's `status`, nothing about who sits where. From it we show open or
 * closed, the closing time (re-formatted in the reader's locale) and the
 * number of AVAILABLE pods.
 *
 * Never invent numbers: anything missing or malformed becomes null, and
 * the UI hides what it can't back with data. A failed poll drops to
 * "error", which hides the pill rather than showing stale figures.
 *
 * Every component asking about the same location shares one poller (a
 * small module store read through useSyncExternalStore), so the hero and
 * the City Creek card don't double the requests.
 */
import { useSyncExternalStore } from "react";
import { SITE_API_URL } from "./api";

export const LIVE_POLL_MS = 60_000;

export interface LiveStatus {
  isOpen: boolean;
  /** Minutes after midnight (location time) the location closes today, or null if the API didn't say. */
  closesAt: number | null;
  /** Pods whose status is AVAILABLE, or null if the API sent no seat list. */
  podsFree: number | null;
  podsTotal: number | null;
}

export type LiveState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: LiveStatus }
  | { status: "error" };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** "9pm" / "8:45pm" / "12am" (the API's formatMinutesToDisplay) or "21:00" -> minutes after midnight. */
export function parseClock(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const s = text.trim().toLowerCase();
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(s);
  if (ampm) {
    const h = Number(ampm[1]);
    const m = ampm[2] ? Number(ampm[2]) : 0;
    if (h < 1 || h > 12 || m > 59) return null;
    return ((h % 12) + (ampm[3] === "pm" ? 12 : 0)) * 60 + m;
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (h24) {
    const h = Number(h24[1]);
    const m = Number(h24[2]);
    if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
    return h * 60 + m;
  }
  return null;
}

/** Minutes after midnight as a locale clock time ("9 PM", "21:00", "晚上9:00"). */
export function formatClock(minutes: number, locale: string): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: m === 0 && locale.startsWith("en") ? undefined : "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** The availability response as a LiveStatus, or null when it isn't one. */
export function toLiveStatus(body: unknown): LiveStatus | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { isOpen?: unknown; closesAt?: unknown; seats?: unknown };
  if (typeof b.isOpen !== "boolean") return null;
  const seats = Array.isArray(b.seats) ? (b.seats as Array<{ status?: unknown }>) : null;
  return {
    isOpen: b.isOpen,
    closesAt: parseClock(b.closesAt),
    podsFree: seats && seats.length > 0 ? seats.filter((s) => s?.status === "AVAILABLE").length : null,
    podsTotal: seats && seats.length > 0 ? seats.length : null,
  };
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Today's hours from a location's `operatingHours` JSON
 * (`{ mon: { open: "11:00", close: "21:00" }, sun: null }`), in the
 * location's time zone. "closed" when today is explicitly null; null when
 * there's no usable data (the caller then shows only open or closed).
 */
export function hoursToday(
  operatingHours: unknown,
  now: Date,
  timeZone = "America/Denver",
): { open: number; close: number } | "closed" | null {
  if (!operatingHours || typeof operatingHours !== "object") return null;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(now).slice(0, 3).toLowerCase();
  if (!(WEEKDAYS as readonly string[]).includes(weekday)) return null;
  const hours = operatingHours as Record<string, unknown>;
  if (!(weekday in hours)) return null;
  const day = hours[weekday];
  if (day === null) return "closed";
  if (!day || typeof day !== "object") return null;
  const open = parseClock((day as { open?: unknown }).open);
  const close = parseClock((day as { close?: unknown }).close);
  return open === null || close === null ? null : { open, close };
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The location nearest `from`, ignoring rows without real coordinates. */
export function nearest<T extends { lat: number | null; lng: number | null }>(from: { lat: number; lng: number }, rows: T[]): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const row of rows) {
    if (typeof row.lat !== "number" || typeof row.lng !== "number" || (row.lat === 0 && row.lng === 0)) continue;
    const km = distanceKm(from, { lat: row.lat, lng: row.lng });
    if (km < bestKm) {
      best = row;
      bestKm = km;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Shared poller
// ---------------------------------------------------------------------------

interface Entry {
  id: string;
  state: LiveState;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  controller: AbortController | null;
  fetchedAt: number;
}

const IDLE: LiveState = { status: "idle" };
const LOADING: LiveState = { status: "loading" };
const entries = new Map<string, Entry>();
let visibilityBound = false;

function hidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function emit(entry: Entry, state: LiveState) {
  entry.state = state;
  for (const l of entry.listeners) l();
}

async function poll(entry: Entry) {
  entry.controller?.abort();
  const controller = new AbortController();
  entry.controller = controller;
  try {
    const res = await fetch(`${SITE_API_URL}/locations/${encodeURIComponent(entry.id)}/availability`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = toLiveStatus(await res.json());
    if (controller.signal.aborted) return;
    entry.fetchedAt = Date.now();
    emit(entry, data ? { status: "ready", data } : { status: "error" });
  } catch {
    if (!controller.signal.aborted) emit(entry, { status: "error" });
  }
}

function startTimer(entry: Entry) {
  if (entry.timer || hidden()) return;
  entry.timer = setInterval(() => void poll(entry), LIVE_POLL_MS);
}

function stopTimer(entry: Entry) {
  if (entry.timer) clearInterval(entry.timer);
  entry.timer = null;
}

function onVisibility() {
  for (const entry of entries.values()) {
    if (entry.listeners.size === 0) continue;
    if (hidden()) {
      stopTimer(entry);
      continue;
    }
    // Back in view: refresh straight away if the numbers are stale, then resume.
    if (Date.now() - entry.fetchedAt >= LIVE_POLL_MS) void poll(entry);
    startTimer(entry);
  }
}

function subscribeTo(id: string, listener: () => void): () => void {
  let entry = entries.get(id);
  if (!entry) {
    entry = { id, state: LOADING, listeners: new Set(), timer: null, controller: null, fetchedAt: 0 };
    entries.set(id, entry);
  }
  const e = entry;
  e.listeners.add(listener);
  if (!visibilityBound && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    visibilityBound = true;
  }
  if (e.listeners.size === 1) {
    if (Date.now() - e.fetchedAt >= LIVE_POLL_MS && !hidden()) void poll(e);
    startTimer(e);
  }
  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size === 0) {
      stopTimer(e);
      e.controller?.abort();
    }
  };
}

/** Test hook: forget every poller (timers stopped). */
export function resetLiveStatusForTests() {
  for (const e of entries.values()) {
    stopTimer(e);
    e.controller?.abort();
  }
  entries.clear();
  if (visibilityBound && typeof document !== "undefined" && typeof document.removeEventListener === "function") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
  visibilityBound = false;
}

/** Subscribe outside React (tests, or a non-hook caller). */
export function subscribeLiveStatus(id: string, listener: () => void): () => void {
  return subscribeTo(id, listener);
}

export function getLiveStatus(id: string | null): LiveState {
  if (!id) return IDLE;
  return entries.get(id)?.state ?? LOADING;
}

/**
 * Live status for one location, polled every 60 s while the tab is
 * visible. `null` (no location id known) stays idle.
 */
export function useLiveStatus(locationId: string | null): LiveState {
  return useSyncExternalStore(
    (listener) => (locationId ? subscribeTo(locationId, listener) : () => {}),
    () => getLiveStatus(locationId),
    () => (locationId ? LOADING : IDLE),
  );
}
