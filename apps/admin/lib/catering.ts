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
  dob?: string;
  zodiac?: string;
  createdAt: string;
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
    eventDate: event.eventDate ? event.eventDate.slice(0, 10) : "", slot: event.slot, status: event.status,
    pricePerBowlCents: (event.pricePerBowlCents / 100).toFixed(2), minimumBowls: String(event.minimumBowls),
    bookedBowls: String(event.bookedBowls ?? 0), eventName: event.eventName || "", logoUrl: event.logoUrl || "",
    brandColors: event.brandColors || [], companyDescription: event.companyDescription || "", notes: event.notes || "",
    eventType: event.eventType || "", expectedGuests: event.expectedGuests != null ? String(event.expectedGuests) : "",
    dietaryNotes: event.dietaryNotes || "", setupNotes: event.setupNotes || "",
    onsiteContactName: event.onsiteContactName || "", onsiteContactPhone: event.onsiteContactPhone || "",
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
  if (price === null || price <= 0) errors.pricePerBowlCents = "Enter a price greater than 0.";

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
    eventDate: f.eventDate,
    slot: f.slot,
    pricePerBowlCents: dollarsToCents(f.pricePerBowlCents) ?? 0,
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
  };
  if (editing) {
    body.status = f.status;
    const booked = wholeNumber(f.bookedBowls);
    if (booked !== null) body.bookedBowls = booked;
  }
  return body;
}

/** "$249.90 (10 bowls x $24.99)" for the Pricing section. */
export function minimumCommitment(f: Pick<EventForm, "pricePerBowlCents" | "minimumBowls">): string | null {
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
