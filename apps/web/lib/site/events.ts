/**
 * Private events (/e/[slug]): the public event and the guest behind an
 * invite link, fetched server-side, plus the small path and title helpers
 * the event pages share. No "use client": the fetchers run in server
 * components (layout and pages); the helpers are safe anywhere, and the
 * browser calls at the bottom run from the client steps.
 */
import { cache } from "react";
import { serverApiHeaders } from "@/lib/server/api-headers";
import type { MenuStep, OrderLine } from "./order-draft";

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

/* ---- Browser calls for the guest, bowl and done steps (public attendee routes) ---- */

const TENANT_HEADER = { "x-tenant-slug": "oh" };
const eventApi = (slug: string, rest = "") => `${API_URL}/catering/events/${encodeURIComponent(slug)}${rest}`;

/** One call's outcome. `data` is set when `ok`; `status` 0 means the API was not reached (a network failure). */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  body: Record<string, unknown> | null;
}

async function send<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    // content-type only with a body: Fastify rejects an empty JSON body (the DELETE).
    const headers = init.body ? { ...TENANT_HEADER, "content-type": "application/json" } : TENANT_HEADER;
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    return { ok: false, status: 0, data: null, error: null, body: null };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) return { ok: false, status: res.status, data: null, error: typeof body?.error === "string" ? body.error : null, body };
  return { ok: true, status: res.status, data: body as T, error: null, body };
}

export interface RsvpInput {
  name: string;
  phone: string;
  dob?: string | null;
  notes?: string | null;
  rsvpToken?: string | null;
}

/** POST /catering/events/:slug/rsvp. 409 when the phone belongs to another guest. */
export function submitRsvp(slug: string, input: RsvpInput): Promise<ApiResult<{ rememberToken: string; zodiac: string | null }>> {
  return send(eventApi(slug, "/rsvp"), { method: "POST", body: JSON.stringify(input) });
}

/** GET /catering/events/:slug/menu-steps: the event's bowl (soup, noodles) and the sliders. */
export async function fetchEventMenuSteps(slug: string, locale: string): Promise<MenuStep[] | null> {
  const r = await send<{ steps?: MenuStep[] }>(eventApi(slug, `/menu-steps?locale=${encodeURIComponent(locale)}`));
  const steps = r.data?.steps;
  return r.ok && Array.isArray(steps) ? steps : null;
}

export interface ExistingEventOrder {
  orderId: string;
  orderQrCode: string;
  canEdit: boolean;
}

/** GET /catering/events/:slug/order/check: this phone's live (not cancelled) order, or null. */
export async function checkEventOrder(slug: string, phone: string): Promise<ExistingEventOrder | null> {
  const r = await send<{ exists?: boolean; orderId?: string; orderQrCode?: string; canEdit?: boolean }>(eventApi(slug, `/order/check?phone=${encodeURIComponent(phone)}`));
  if (!r.ok || !r.data?.exists || !r.data.orderId || !r.data.orderQrCode) return null;
  return { orderId: r.data.orderId, orderQrCode: r.data.orderQrCode, canEdit: Boolean(r.data.canEdit) };
}

/** POST /catering/events/:slug/order. A 400 with `existingOrderQrCode` means this phone already has a bowl. */
export function placeEventOrder(
  slug: string,
  input: { items: OrderLine[]; guestName: string; guestPhone: string; dob?: string | null },
): Promise<ApiResult<{ orderId: string; orderQrCode: string; statusPath: string }>> {
  return send(eventApi(slug, "/order"), { method: "POST", body: JSON.stringify(input) });
}

/** DELETE /catering/events/:slug/order/:orderId (before the start only). */
export async function cancelEventOrder(slug: string, orderId: string): Promise<boolean> {
  const r = await send(eventApi(slug, `/order/${encodeURIComponent(orderId)}`), { method: "DELETE" });
  return r.ok;
}

export interface EventOrderItem {
  name: string | null;
  quantity: number;
  selectedValue: string | null;
  selectedLabel?: string | null;
}

/** GET /orders/status: the order's id and lines (names and slider labels in `locale`). */
export async function fetchEventOrder(orderQrCode: string, locale: string): Promise<{ id: string; status: string; items: EventOrderItem[] } | null> {
  type View = { id?: string; status?: string; items?: EventOrderItem[] };
  const r = await send<{ order?: View }>(`${API_URL}/orders/status?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=${encodeURIComponent(locale)}`);
  const order = r.data?.order; // the view comes wrapped: { order: {...} }
  if (!r.ok || typeof order?.id !== "string") return null;
  return { id: order.id, status: order.status ?? "", items: Array.isArray(order.items) ? order.items : [] };
}
