/**
 * Private events: fetches the event once for every page under /e/[slug] and
 * hands it down through EventProvider. Only LIVE and COMPLETED events are
 * public; anything else is a 404 (../not-found.tsx).
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { EventProvider } from "@/components/site/events/EventProvider";
import { eventTitle, fetchEvent } from "@/lib/site/events";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  return { ...(event ? { title: eventTitle(event) } : {}), robots: { index: false, follow: false } };
}

export default async function Layout({ children, params }: { children: ReactNode; params: Params }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event || !["LIVE", "COMPLETED"].includes(event.status)) notFound();
  return <EventProvider event={event}>{children}</EventProvider>;
}
