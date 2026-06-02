/**
 * Catering attendee remember-me cookie.
 *
 * Stores {name, phone, eventSlug} so the RSVP/order pages can pre-fill
 * the identity form on return visits. Cookie expires in 30 days.
 *
 * Mirrors the pattern in apps/web/lib/guest-session.ts.
 */

const COOKIE_NAME = "oh_catering_attendee";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CateringAttendee {
  name: string;
  phone: string;
  eventSlug: string;
}

/** Read the remember-me cookie (client-side only). Returns null if absent. */
export function getRememberedAttendee(): CateringAttendee | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(rest.join("="))) as CateringAttendee;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Write the remember-me cookie (client-side only). */
export function setRememberedAttendee(attendee: CateringAttendee): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + TTL_MS).toUTCString();
  const value = encodeURIComponent(JSON.stringify(attendee));
  document.cookie = `${COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

/** Clear the remember-me cookie. */
export function clearRememberedAttendee(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
