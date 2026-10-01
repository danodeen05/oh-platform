/**
 * Private events: the invitation, /{locale}/e/{slug}[?rsvp={token}]. An
 * invite link carries the guest's token, so the page can greet them by name.
 */
import { fetchRsvpByToken } from "@/lib/site/events";
import { EventInvite } from "./EventInvite";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function EventInvitePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.rsvp)?.trim() || null;
  const guest = token ? await fetchRsvpByToken(slug, token) : null;
  return <EventInvite guest={guest} token={guest ? token : null} />;
}
