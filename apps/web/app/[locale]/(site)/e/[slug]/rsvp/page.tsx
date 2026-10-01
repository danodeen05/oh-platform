/**
 * Private events: who is coming, /{locale}/e/{slug}/rsvp[?rsvp={token}]. An
 * invite link's token prefills the form with what the host already knows.
 */
import { fetchRsvpByToken } from "@/lib/site/events";
import { GuestStep } from "./GuestStep";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function EventRsvpPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.rsvp)?.trim() || null;
  const guest = token ? await fetchRsvpByToken(slug, token) : null;
  return <GuestStep guest={guest} token={guest ? token : null} />;
}
