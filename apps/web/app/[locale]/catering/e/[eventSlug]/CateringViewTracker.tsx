"use client";

import { useEffect } from "react";
import { trackCateringView } from "@/lib/catering/analytics";

/** Client component that fires the catering_view GA event on page load. */
export function CateringViewTracker({ eventSlug }: { eventSlug: string }) {
  useEffect(() => {
    trackCateringView(eventSlug);
  }, [eventSlug]);
  return null;
}
