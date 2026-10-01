/** Private events: the bowl is reserved, /{locale}/e/{slug}/done. Reads the guest from this browser, so it renders client-side. */
import { EventDone } from "./EventDone";

export const dynamic = "force-dynamic";

export default function EventDonePage() {
  return <EventDone />;
}
