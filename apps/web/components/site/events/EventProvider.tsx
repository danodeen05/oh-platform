"use client";

/** Private events: the event the [slug] layout fetched, for every client component below it. */
import { createContext, useContext, type ReactNode } from "react";
import type { PublicEvent } from "@/lib/site/events";

const EventContext = createContext<PublicEvent | null>(null);

export function EventProvider({ event, children }: { event: PublicEvent; children: ReactNode }) {
  return <EventContext.Provider value={event}>{children}</EventContext.Provider>;
}

export function useEvent(): PublicEvent {
  const event = useContext(EventContext);
  if (!event) throw new Error("useEvent() must be used inside <EventProvider>");
  return event;
}
