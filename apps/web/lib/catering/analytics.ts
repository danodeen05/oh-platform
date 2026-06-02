/**
 * Catering-specific GA4 event wrappers.
 * Reuses the safe sendEvent pattern from lib/analytics.ts.
 * No-ops if gtag is absent — never blocks render.
 */

function sendEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch {
    // silently ignore — analytics must never break the page
  }
}

export const trackCateringView = (eventSlug: string) =>
  sendEvent("catering_view", { event_slug: eventSlug });

export const trackCateringBookingStart = () =>
  sendEvent("catering_booking_start");

export const trackCateringSlotSelected = (slot: string, date: string) =>
  sendEvent("catering_slot_selected", { slot, date });

export const trackCateringBookingSubmitted = (bowls: number) =>
  sendEvent("catering_booking_submitted", { bowls });

export const trackCateringPaymentSuccess = (amountCents: number) =>
  sendEvent("catering_payment_success", { value: amountCents / 100, currency: "USD" });

export const trackCateringRsvp = (eventSlug: string) =>
  sendEvent("catering_rsvp", { event_slug: eventSlug });

export const trackCateringOrderPlaced = (eventSlug: string) =>
  sendEvent("catering_order_placed", { event_slug: eventSlug });
