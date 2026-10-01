import type { BadgeTone } from "../components/ui/Badge";
import { dollarsToCents } from "../components/ui/Field";

export type CateringEventStatus = "PLANNING" | "ENRICHING" | "NEEDS_REVIEW" | "LIVE" | "COMPLETED";
export type CateringSlot = "LUNCH" | "DINNER";

/** Default price per bowl in cents, applied when the slot toggle changes. */
export const SLOT_PRICE: Record<CateringSlot, number> = { LUNCH: 2499, DINNER: 2999 };

export const STATUSES: CateringEventStatus[] = ["PLANNING", "ENRICHING", "NEEDS_REVIEW", "LIVE", "COMPLETED"];
export const EVENT_TYPES = ["Corporate", "Family Gathering", "Wedding", "Birthday", "Other"];

const STATUS_TONE: Record<CateringEventStatus, BadgeTone> = {
  PLANNING: "info", ENRICHING: "pending", NEEDS_REVIEW: "alert", LIVE: "good", COMPLETED: "neutral",
};
const STATUS_LABEL: Record<CateringEventStatus, string> = {
  PLANNING: "Planning", ENRICHING: "Enriching", NEEDS_REVIEW: "Needs review", LIVE: "Live", COMPLETED: "Completed",
};
export const statusTone = (s: CateringEventStatus): BadgeTone => STATUS_TONE[s] ?? "neutral";
export const statusLabel = (s: CateringEventStatus): string => STATUS_LABEL[s] ?? s;
export const slotLabel = (s: CateringSlot): string => (s === "LUNCH" ? "Lunch" : "Dinner");

export interface CateringBooking {
  paymentStatus: string;
  priceCents: number;
  paidCents: number;
  promoCode?: string;
  bowlsBooked: number;
  bookingToken: string;
}

export interface CateringEvent {
  id: string;
  slug: string;
  eventCode: string;
  clientCompany: string;
  clientWebsite?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  eventDate: string; // ISO date string
  slot: CateringSlot;
  pricePerBowlCents: number;
  minimumBowls: number;
  bookedBowls: number;
  status: CateringEventStatus;
  eventName?: string;
  logoUrl?: string;
  brandColors: string[];
  companyDescription?: string;
  notes?: string;
  hostName?: string | null;
  welcomeNote?: string | null;
  eventAddress?: string | null;
  eventLat?: number | null;
  eventLng?: number | null;
  eventType?: string | null;
  expectedGuests?: number | null;
  dietaryNotes?: string | null;
  setupNotes?: string | null;
  onsiteContactName?: string | null;
  onsiteContactPhone?: string | null;
  booking?: CateringBooking;
}

/** What enrichFromWebsite found, stashed on the event as raw JSON while it's reviewed. */
export interface EnrichmentRaw {
  logoUrl?: string | null;
  brandColors?: string[];
  suggestedEventName?: string | null;
  companyDescription?: string | null;
  error?: string;
}

/** GET .../enrichment: the event's current fields plus the raw AI suggestion, if any. */
export interface EnrichmentSuggestion {
  id: string;
  status: CateringEventStatus;
  enrichmentRaw?: EnrichmentRaw | null;
  eventName?: string | null;
  logoUrl?: string | null;
  brandColors: string[];
  companyDescription?: string | null;
}

/** The suggested values to seed the review form with: the AI's raw find, falling back to the event's current fields. */
export function enrichmentFormValues(e: EnrichmentSuggestion): { eventName: string; logoUrl: string; brandColors: string[]; companyDescription: string; error?: string } {
  const raw = e.enrichmentRaw && !e.enrichmentRaw.error ? e.enrichmentRaw : null;
  return {
    eventName: raw?.suggestedEventName || e.eventName || "",
    logoUrl: raw?.logoUrl || e.logoUrl || "",
    brandColors: (raw?.brandColors?.length ? raw.brandColors : e.brandColors?.length ? e.brandColors : ["#4f46e5"]),
    companyDescription: raw?.companyDescription || e.companyDescription || "",
    error: e.enrichmentRaw?.error,
  };
}

export interface Rsvp {
  id: string;
  name: string;
  phone: string;
  dob?: string | null;
  zodiac?: string | null;
  notes?: string | null;
  createdAt: string;
  inviteUrl?: string;
  ordered?: boolean;
  orderQrCode?: string | null;
}

export interface CateringOrderItem {
  quantity: number;
  selectedValue?: string | null;
  menuItem: { name: string };
}

export interface CateringOrder {
  id: string;
  guestName?: string;
  guestPhone?: string;
  guest?: { name?: string; phone?: string };
  items: CateringOrderItem[];
  totalCents: number;
  status?: string;
  createdAt: string;
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: number;
  unit: string;
}

/** GET .../overage. The API has no way to report a previously-created charge; a fresh charge is only known within the session that created it. */
export interface Overage {
  bookedBowls: number;
  orderedCount: number;
  overageBowls: number;
  overageAmountCents: number;
  pricePerBowlCents: number;
}

export interface OverageInvoiceResult {
  charge: { id: string; status: string; bowlCount: number; amountCents: number };
  invoice: { id: string; url: string | null };
}

export interface SurveyAreaAverages {
  food: number;
  speed: number;
  experience: number;
  recommend: number;
}

export interface SurveyResponse {
  id: string;
  guestName?: string;
  guestPhone?: string;
  comment?: string | null;
  overallScore: number;
  areaScores?: Record<string, number>;
  createdAt: string;
}

export interface SurveyStats {
  surveyId?: string;
  responseCount?: number;
  overallScore?: number;
  areaAverages?: Partial<SurveyAreaAverages>;
  aiSummary?: string;
  responses?: SurveyResponse[];
}

export interface CateringAnalytics {
  eventsCreated: number;
  bookingsStarted: number;
  bookingsConfirmed: number;
  bookingConversionPct: number;
  rsvpCount: number;
  rsvpPerEvent: number;
  attendeeOrders: number;
  orderConversionPct: number;
}

export interface CalendarSlotInfo {
  date: string;
  slot: CateringSlot;
  booked: boolean;
  blocked?: boolean;
  clientCompany?: string;
  eventId?: string;
}

export interface Blackout {
  id: string;
  weekday: number | null;
  startDate: string | null;
  endDate: string | null;
  slot: CateringSlot | null;
  reason: string | null;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function blackoutSlotLabel(slot: Blackout["slot"]): string {
  if (slot === "LUNCH") return "Lunch only";
  if (slot === "DINNER") return "Dinner only";
  return "Whole day";
}

export function describeBlackout(b: Blackout): string {
  const scope = blackoutSlotLabel(b.slot);
  if (b.weekday !== null && b.weekday !== undefined) return `Every ${WEEKDAYS[b.weekday]} · ${scope}`;
  const start = b.startDate?.slice(0, 10);
  const end = b.endDate?.slice(0, 10);
  if (start && end && start !== end) return `${start} to ${end} · ${scope}`;
  return `${start} · ${scope}`;
}

// --- Event form ---

export type EventForm = {
  clientCompany: string; clientWebsite: string; contactName: string; contactEmail: string; contactPhone: string;
  eventAddress: string; eventLat: string; eventLng: string; eventDate: string; slot: CateringSlot;
  status: CateringEventStatus; pricePerBowlCents: string; minimumBowls: string; bookedBowls: string;
  eventName: string; logoUrl: string; brandColors: string[]; companyDescription: string; notes: string;
  eventType: string; expectedGuests: string; dietaryNotes: string; setupNotes: string;
  onsiteContactName: string; onsiteContactPhone: string;
  startTime: string; hostName: string; welcomeNote: string; complimentary: boolean;
};

/** Default start time ("HH:mm", Denver) for a slot. */
export const defaultStartTime = (slot: CateringSlot): string => (slot === "DINNER" ? "18:00" : "12:00");

/** 30-minute start options from 10:00 to 21:00. */
export const START_TIMES: { value: string; label: string }[] = Array.from({ length: 23 }, (_, i) => {
  const mins = 10 * 60 + i * 30;
  const h = Math.floor(mins / 60), m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` };
});

const DENVER = "America/Denver";

function denverParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** UTC ISO for a Denver wall-clock date ("YYYY-MM-DD") and time ("HH:mm"). */
export function combineDateTime(dateISO: string, time: string, tz = DENVER): string {
  const [y, mo, d] = dateISO.slice(0, 10).split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (utcMs: number): number => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(utcMs));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - utcMs;
  };
  let utc = wall - offsetAt(wall);
  utc = wall - offsetAt(utc);
  return new Date(utc).toISOString();
}

/** Denver date and time of a UTC ISO string. */
export function splitDateTime(iso: string): { date: string; time: string } {
  const p = denverParts(new Date(iso));
  const two = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${two(p.mo)}-${two(p.d)}`, time: `${two(p.h)}:${two(p.mi)}` };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "03/14/1990" to "Mar 14, 1990". Anything unparseable comes back as is. */
export function formatBirthday(dob: string | null | undefined): string {
  if (!dob) return "";
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (!m) return dob;
  return `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}, ${m[3]}`;
}

/** "(801) 555-0100" from 10 digits; other input comes back as is. */
export function formatPhone(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : phone || "";
}

/** "MM/DD/YYYY" to the "YYYY-MM-DD" a date input wants, and back. */
export const dobToInput = (dob: string | null | undefined): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob || "");
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "";
};
export const inputToDob = (v: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
};

const priceDollars = (slot: CateringSlot) => (SLOT_PRICE[slot] / 100).toFixed(2);

export function emptyEventForm(prefillDate?: string, prefillSlot?: CateringSlot): EventForm {
  const slot = prefillSlot || "LUNCH";
  return {
    clientCompany: "", clientWebsite: "", contactName: "", contactEmail: "", contactPhone: "",
    eventAddress: "", eventLat: "", eventLng: "", eventDate: prefillDate || "", slot,
    status: "PLANNING", pricePerBowlCents: priceDollars(slot), minimumBowls: "10", bookedBowls: "0",
    eventName: "", logoUrl: "", brandColors: [], companyDescription: "", notes: "",
    eventType: "", expectedGuests: "", dietaryNotes: "", setupNotes: "", onsiteContactName: "", onsiteContactPhone: "",
    startTime: defaultStartTime(slot), hostName: "", welcomeNote: "", complimentary: false,
  };
}

/** The default per-bowl price (in dollars, for the form) for a slot. Applied when the slot toggle changes. */
export function defaultPriceForSlot(slot: CateringSlot): string {
  return priceDollars(slot);
}

export function formFromEvent(event: CateringEvent | null, prefillDate?: string, prefillSlot?: CateringSlot): EventForm {
  if (!event) return emptyEventForm(prefillDate, prefillSlot);
  return {
    clientCompany: event.clientCompany, clientWebsite: event.clientWebsite || "", contactName: event.contactName || "",
    contactEmail: event.contactEmail || "", contactPhone: event.contactPhone || "", eventAddress: event.eventAddress || "",
    eventLat: event.eventLat != null ? String(event.eventLat) : "", eventLng: event.eventLng != null ? String(event.eventLng) : "",
    eventDate: event.eventDate ? splitDateTime(event.eventDate).date : "", slot: event.slot, status: event.status,
    pricePerBowlCents: (event.pricePerBowlCents / 100).toFixed(2), minimumBowls: String(event.minimumBowls),
    bookedBowls: String(event.bookedBowls ?? 0), eventName: event.eventName || "", logoUrl: event.logoUrl || "",
    brandColors: event.brandColors || [], companyDescription: event.companyDescription || "", notes: event.notes || "",
    eventType: event.eventType || "", expectedGuests: event.expectedGuests != null ? String(event.expectedGuests) : "",
    dietaryNotes: event.dietaryNotes || "", setupNotes: event.setupNotes || "",
    onsiteContactName: event.onsiteContactName || "", onsiteContactPhone: event.onsiteContactPhone || "",
    startTime: splitDateTime(event.eventDate).time, hostName: event.hostName || "", welcomeNote: event.welcomeNote || "",
    complimentary: event.pricePerBowlCents === 0,
  };
}

const wholeNumber = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
const isFloat = (s: string): boolean => s.trim() === "" || Number.isFinite(Number(s.trim()));

/** Field errors for the sheet. Errors show inline, never as toasts. */
export function validateEvent(f: EventForm): Partial<Record<keyof EventForm, string>> {
  const errors: Partial<Record<keyof EventForm, string>> = {};
  if (!f.clientCompany.trim()) errors.clientCompany = "Give the event a company.";
  if (!f.eventDate.trim()) errors.eventDate = "Pick a date.";

  const price = dollarsToCents(f.pricePerBowlCents);
  if (!f.complimentary && (price === null || price <= 0)) errors.pricePerBowlCents = "Enter a price greater than 0.";

  const min = wholeNumber(f.minimumBowls);
  if (min === null || min <= 0) errors.minimumBowls = "Enter a whole number greater than 0.";

  if (!isFloat(f.eventLat)) errors.eventLat = "Enter a valid latitude.";
  if (!isFloat(f.eventLng)) errors.eventLng = "Enter a valid longitude.";

  return errors;
}

export type EventBody = {
  clientCompany: string; clientWebsite?: string; contactName?: string; contactEmail?: string; contactPhone?: string;
  eventAddress?: string; eventLat?: number; eventLng?: number; eventDate: string; slot: CateringSlot;
  pricePerBowlCents: number; minimumBowls: number; eventName?: string; logoUrl?: string; brandColors: string[];
  companyDescription?: string; notes?: string; eventType?: string; expectedGuests: number | null;
  dietaryNotes?: string; setupNotes?: string; onsiteContactName?: string; onsiteContactPhone?: string;
  status?: CateringEventStatus; bookedBowls?: number;
  hostName?: string; welcomeNote?: string;
};

const trimOrUndefined = (s: string) => s.trim() || undefined;

/** The create/update body. Empty optional strings become undefined; status and bookedBowls only apply on edit. */
export function eventBody(f: EventForm, editing: boolean): EventBody {
  const expectedGuestsNum = wholeNumber(f.expectedGuests);
  const body: EventBody = {
    clientCompany: f.clientCompany.trim(),
    clientWebsite: trimOrUndefined(f.clientWebsite),
    contactName: trimOrUndefined(f.contactName),
    contactEmail: trimOrUndefined(f.contactEmail),
    contactPhone: trimOrUndefined(f.contactPhone),
    eventAddress: trimOrUndefined(f.eventAddress),
    eventLat: f.eventLat.trim() ? Number(f.eventLat) : undefined,
    eventLng: f.eventLng.trim() ? Number(f.eventLng) : undefined,
    eventDate: combineDateTime(f.eventDate, f.startTime || defaultStartTime(f.slot)),
    slot: f.slot,
    pricePerBowlCents: f.complimentary ? 0 : dollarsToCents(f.pricePerBowlCents) ?? 0,
    minimumBowls: wholeNumber(f.minimumBowls) ?? 0,
    eventName: trimOrUndefined(f.eventName),
    logoUrl: trimOrUndefined(f.logoUrl),
    brandColors: f.brandColors.filter(Boolean),
    companyDescription: trimOrUndefined(f.companyDescription),
    notes: trimOrUndefined(f.notes),
    eventType: trimOrUndefined(f.eventType),
    expectedGuests: expectedGuestsNum !== null && expectedGuestsNum > 0 ? expectedGuestsNum : null,
    dietaryNotes: trimOrUndefined(f.dietaryNotes),
    setupNotes: trimOrUndefined(f.setupNotes),
    onsiteContactName: trimOrUndefined(f.onsiteContactName),
    onsiteContactPhone: trimOrUndefined(f.onsiteContactPhone),
    hostName: trimOrUndefined(f.hostName),
    welcomeNote: trimOrUndefined(f.welcomeNote),
  };
  if (editing) {
    body.status = f.status;
    const booked = wholeNumber(f.bookedBowls);
    if (booked !== null) body.bookedBowls = booked;
  }
  return body;
}

/** "$249.90 (10 bowls x $24.99)" for the Pricing section. */
export function minimumCommitment(f: Pick<EventForm, "pricePerBowlCents" | "minimumBowls"> & { complimentary?: boolean }): string | null {
  if (f.complimentary) return null;
  const price = dollarsToCents(f.pricePerBowlCents);
  const bowls = wholeNumber(f.minimumBowls);
  if (price === null || bowls === null) return null;
  return `$${((price * bowls) / 100).toFixed(2)} (${bowls} bowls x $${(price / 100).toFixed(2)})`;
}

export function eventDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Denver", weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// --- Orders tab ---

const SPECIAL_DIET = ["no beef", "no meat", "no noodles", "soup only", "vegetarian"];
export function isSpecialDiet(o: Pick<CateringOrder, "items">): boolean {
  return o.items.some((i) => {
    const hay = `${i.menuItem?.name || ""} ${i.selectedValue || ""}`.toLowerCase();
    return SPECIAL_DIET.some((t) => hay.includes(t));
  });
}

// --- Survey tab ---

export function surveyTone(score: number): "good" | "pending" | "alert" {
  if (score >= 4) return "good";
  if (score >= 3) return "pending";
  return "alert";
}

/** The lowest area is alert if it's below 4; every other area is neutral. */
export function areaTone(value: number, isLowest: boolean): "alert" | "neutral" {
  return isLowest && value < 4 ? "alert" : "neutral";
}
