/** Private events: build the bowl, /{locale}/e/{slug}/order. Everything happens client-side (the guest lives in this browser). */
import { EventBowlStep } from "./EventBowlStep";

export const dynamic = "force-dynamic";

export default function EventOrderPage() {
  return <EventBowlStep />;
}
