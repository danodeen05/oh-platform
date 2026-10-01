// Pure helpers for the attendee (private event) flow. No Prisma here.
const OPEN_PATHS = new Set(["/catering/site-config/order-now", "/catering/kitchen-locations"]);
const ATTENDEE_PREFIXES = ["/catering/events/", "/catering/orders/", "/catering/menu/"];

export function isAttendeePath(path) {
  if (OPEN_PATHS.has(path)) return true;
  return path === "/catering/menu" || ATTENDEE_PREFIXES.some((p) => path.startsWith(p));
}

export function normalizeGuestPhone(input) {
  const d = String(input || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

const denverFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
export function denverDateKey(date) { return denverFmt.format(date); } // en-CA gives YYYY-MM-DD
export function isEventDay(eventDate, now = new Date()) { return denverDateKey(new Date(eventDate)) === denverDateKey(now); }

// Attendees get the bowl (every soup and noodle) and the customize sliders only; no extras or drinks.
export function filterMenuSteps(steps) {
  return (steps || []).filter((s) => s.id === "bowl" || s.id === "customize");
}

// Field mapping for an RSVP update. Omitted (undefined) dob/notes keep the stored value;
// an explicit empty string clears it. zodiacFn maps a dob string to a zodiac (or null).
export function rsvpUpdateData({ name, phone, dob, notes }, zodiacFn = () => null) {
  const data = { name, phone };
  if (dob !== undefined) {
    data.dob = dob || null;
    data.zodiac = dob ? zodiacFn(dob) : null;
  }
  if (notes !== undefined) {
    const clean = typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 500) : null;
    data.notes = clean;
  }
  return data;
}

// Date part for an event slug: date-only strings are used as written; timestamps use the Denver calendar day.
export function slugDateKey(eventDate) {
  if (typeof eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return eventDate;
  return denverDateKey(new Date(eventDate));
}
