export type CateringEventStatus =
  | "PLANNING"
  | "ENRICHING"
  | "NEEDS_REVIEW"
  | "LIVE"
  | "COMPLETED";

export type CateringSlot = "LUNCH" | "DINNER";

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
  booking?: CateringBooking;
}

export interface EnrichmentSuggestion {
  logoUrl?: string;
  brandColors: string[];
  suggestedEventName?: string;
  companyDescription?: string;
  status: "PENDING" | "ENRICHING" | "NEEDS_REVIEW" | "LIVE";
}

export interface Rsvp {
  id: string;
  name: string;
  phone: string;
  dob?: string;
  zodiac?: string;
  createdAt: string;
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

export interface CateringOrderItem {
  quantity: number;
  selectedValue?: string | null;
  menuItem: { name: string };
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: number;
  unit: string;
}

export interface Overage {
  bowlsBooked: number;
  bowlsOrdered: number;
  overageCount: number;
  overageAmountCents: number;
  charge?: {
    invoiceUrl: string;
    status: string;
  };
}

export interface SurveyAreaAverages {
  food: number;
  speed: number;
  experience: number;
  recommend: number;
}

export interface SurveyComment {
  id: string;
  attendeeName?: string;
  comment: string;
  createdAt: string;
}

export interface SurveyStats {
  overallScore: number;
  areaAverages: SurveyAreaAverages;
  comments: SurveyComment[];
  aiSummary?: string;
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
