/**
 * Typed fetch wrappers for the catering backend.
 * All endpoints are documented in the feature spec.
 * BASE = NEXT_PUBLIC_API_URL (no x-tenant-slug needed — catering routes are public/self-contained)
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ---- Shared types -----------------------------------------------------------

export interface CateringMenuItem {
  id: string;
  name: string;
}

export interface CateringMenu {
  soups: CateringMenuItem[];
  noodles: CateringMenuItem[];
  sliders: CateringMenuItem[];
}

export interface CateringEvent {
  id: string;
  slug: string;
  eventCode: string;
  tenantId: string;
  locationId: string;
  eventName: string;
  clientCompany: string;
  logoUrl: string | null;
  brandColors: string[];
  companyDescription: string | null;
  eventDate: string; // ISO
  slot: "LUNCH" | "DINNER";
  status: string;
  menu: CateringMenu;
}

export interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  slot: "LUNCH" | "DINNER";
  status: "OPEN" | "BOOKED";
}

export interface BookingDraft {
  bookingId: string;
  clientSecret: string;
  amountCents: number;
}

export interface BookingConfirmation {
  eventSlug: string;
  bookingToken: string;
}

export interface DashboardData {
  event: CateringEvent;
  rsvps: Array<{
    id: string;
    name: string;
    phone: string;
    zodiac: string | null;
    createdAt: string;
    ordered: boolean;
  }>;
  shareUrl: string;
}

export interface OrderCheckResult {
  exists: boolean;
  orderId?: string;
  orderQrCode?: string;
  canEdit?: boolean;
  items?: Array<{
    menuItemId: string;
    menuItem: { name: string };
    quantity: number;
    selectedValue?: string | null;
  }>;
}

export interface PlacedOrder {
  orderId: string;
  orderQrCode: string;
  kitchenOrderNumber: number;
  items: unknown[];
}

// ---- API functions ----------------------------------------------------------

export async function fetchCateringEvent(slug: string): Promise<CateringEvent> {
  const res = await fetch(`${BASE}/catering/events/${slug}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Event not found: ${slug}`);
  return res.json();
}

export async function fetchCateringAvailability(
  from: string,
  to: string
): Promise<AvailabilitySlot[]> {
  const res = await fetch(
    `${BASE}/catering/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load availability");
  return res.json();
}

export interface CreateBookingPayload {
  clientCompany: string;
  clientWebsite: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  eventDate: string;
  slot: "LUNCH" | "DINNER";
  bowls: number;
  notes?: string;
}

export async function createBooking(payload: CreateBookingPayload): Promise<BookingDraft> {
  const res = await fetch(`${BASE}/catering/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to create booking");
  }
  return res.json();
}

export async function confirmBooking(
  bookingId: string,
  payload: { paymentIntentId: string; promoCodeId?: string }
): Promise<BookingConfirmation> {
  const res = await fetch(`${BASE}/catering/bookings/${bookingId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to confirm booking");
  }
  return res.json();
}

export async function fetchDashboard(bookingToken: string): Promise<DashboardData> {
  const res = await fetch(`${BASE}/catering/dashboard/${bookingToken}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Dashboard not found");
  return res.json();
}

export async function rsvpToEvent(
  slug: string,
  payload: { name: string; phone: string; dob?: string }
): Promise<{ rememberToken: string }> {
  const res = await fetch(`${BASE}/catering/events/${slug}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "RSVP failed");
  }
  return res.json();
}

export async function checkAttendeeOrder(
  slug: string,
  phone: string
): Promise<OrderCheckResult> {
  const res = await fetch(
    `${BASE}/catering/events/${slug}/order/check?phone=${encodeURIComponent(phone)}`
  );
  if (!res.ok) return { exists: false };
  return res.json();
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  selectedValue?: string;
}

export interface PlaceOrderPayload {
  items: OrderItem[];
  guestName: string;
  guestPhone: string;
  dob?: string;
}

export async function placeOrder(slug: string, payload: PlaceOrderPayload): Promise<PlacedOrder> {
  const res = await fetch(`${BASE}/catering/events/${slug}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Order failed");
  }
  return res.json();
}

export async function deleteOrder(slug: string, orderId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/catering/events/${slug}/order/${orderId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Delete failed");
  }
  return res.json();
}

export interface SurveyPayload {
  qrCode?: string;
  overallScore: number;
  areaScores: {
    food: number;
    speed: number;
    experience: number;
    recommend: number;
  };
  comment?: string;
}

export async function submitSurvey(slug: string, payload: SurveyPayload): Promise<void> {
  const res = await fetch(`${BASE}/catering/events/${slug}/survey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Survey submission failed");
  }
}
