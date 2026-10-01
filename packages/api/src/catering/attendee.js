// Pure helpers for the attendee (private event) flow. No Prisma here.
export const CATERING_SOUP_NOODLE_NAMES = [
  "Classic Beef Noodle Soup", "Classic Beef Noodle Soup (no beef)",
  "Wide Noodles", "Wide Noodles (Gluten Free)", "Thin/Flat Noodles", "No Noodles",
];
const OPEN_PATHS = new Set(["/catering/site-config/order-now", "/catering/kitchen-locations"]);
const ATTENDEE_PREFIXES = ["/catering/events/", "/catering/orders/", "/catering/menu"];

export function isAttendeePath(path) {
  if (OPEN_PATHS.has(path)) return true;
  return ATTENDEE_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export function normalizeGuestPhone(input) {
  const d = String(input || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

const denverFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
export function denverDateKey(date) { return denverFmt.format(date); } // en-CA gives YYYY-MM-DD
export function isEventDay(eventDate, now = new Date()) { return denverDateKey(new Date(eventDate)) === denverDateKey(now); }

export function filterMenuSteps(steps, allowedNames) {
  const allowed = new Set(allowedNames);
  return (steps || []).filter((s) => s.id === "bowl" || s.id === "customize").map((s) => {
    if (s.id !== "bowl") return s;
    return { ...s, sections: s.sections.map((sec) => ({ ...sec, items: (sec.items || []).filter((i) => allowed.has(i.nameEn || i.name)) })) };
  });
}
