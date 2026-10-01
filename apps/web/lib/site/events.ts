/**
 * Private events (/e/[slug]): the public event and the guest behind an
 * invite link, fetched server-side, plus the small path and title helpers
 * the event pages share. No "use client": the fetchers run in server
 * components (layout and pages); the helpers are safe anywhere.
 */
import { cache } from "react";
import { serverApiHeaders } from "@/lib/server/api-headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type EventStatus = "LIVE" | "COMPLETED" | "PLANNING";

export interface PublicEvent {
  slug: string;
  eventName: string | null;
  clientCompany: string;
  hostName: string | null;
  welcomeNote: string | null;
  eventAddress: string | null;
  logoUrl: string | null;
  brandColors: string[];
  startsAt: string;
  timezone: string;
  status: EventStatus;
  isComplimentary: boolean;
}

export interface GuestRsvp {
  name: string;
  phone: string;
  dob: string | null;
  notes: string | null;
  zodiac: string | null;
}

export type EventSubpage = "rsvp" | "order" | "done" | "status";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: serverApiHeaders({ "x-tenant-slug": "oh" }), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * GET /catering/events/:slug, trimmed to the public shape. Null when missing
 * or not public. Memoized per request (the layout and generateMetadata both ask).
 */
export const fetchEvent: (slug: string) => Promise<PublicEvent | null> = cache(async (slug: string) => {
  const raw = await getJson<Partial<PublicEvent>>(`/catering/events/${encodeURIComponent(slug)}`);
  if (!raw || typeof raw.slug !== "string" || typeof raw.startsAt !== "string") return null;
  return {
    slug: raw.slug,
    eventName: raw.eventName ?? null,
    clientCompany: raw.clientCompany ?? "",
    hostName: raw.hostName ?? null,
    welcomeNote: raw.welcomeNote ?? null,
    eventAddress: raw.eventAddress ?? null,
    logoUrl: raw.logoUrl ?? null,
    brandColors: Array.isArray(raw.brandColors) ? raw.brandColors : [],
    startsAt: raw.startsAt,
    timezone: raw.timezone || "America/Denver",
    status: raw.status as EventStatus,
    isComplimentary: Boolean(raw.isComplimentary),
  };
});

/** GET /catering/events/:slug/rsvp/:token: the guest an invite link was sent to. Null when the token is unknown. */
export async function fetchRsvpByToken(slug: string, token: string): Promise<GuestRsvp | null> {
  if (!token) return null;
  return getJson<GuestRsvp>(`/catering/events/${encodeURIComponent(slug)}/rsvp/${encodeURIComponent(token)}`);
}

/** The event's display name: its own name, or the client company. */
export function eventTitle(e: PublicEvent): string {
  return e.eventName?.trim() || e.clientCompany;
}

/** /{locale}/e/{slug}[/{sub}] */
export function eventPath(locale: string, slug: string, sub?: EventSubpage): string {
  return `/${locale}/e/${encodeURIComponent(slug)}${sub ? `/${sub}` : ""}`;
}

/** First name for a greeting ("Kristy Lee" -> "Kristy"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
