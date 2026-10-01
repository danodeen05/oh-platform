/**
 * Private events: follow the bowl, /{locale}/e/{slug}/status?qrCode={code}.
 * Without `qrCode` the view falls back to the order this browser remembers.
 */
import { EventStatusView } from "./EventStatusView";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function EventStatusPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const raw = Array.isArray(q.qrCode) ? q.qrCode[0] : q.qrCode;
  return <EventStatusView code={raw?.trim() || null} />;
}
