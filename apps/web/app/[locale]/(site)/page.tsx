/**
 * Task D1: the home page, an eight-chapter scroll story built for a phone.
 *
 *   1. Arrive          the storefront, the mark written in, Order, live status
 *   2. Walk in         pinned: the hall, rows lighting in sequence
 *   3. The pod         pinned: three photos and the hatch panel opening
 *   4. The bowl        linen: the bowl turning, the callouts, the beef macro
 *   5. No check, no tip  typographic
 *   6. One Red Step    the giving pledge and its red thread, beside the
 *                      no-tip promise (moved up 2026-09-28; links to /giving)
 *   7. Rewards         the tier marks rising, cashback counting up
 *   8. Two locations   live cards, and the close
 *
 * Server-rendered; the only client islands are the pinned chapters, the
 * live status (lib/site/live.ts) and the motion kit's primitives. Data: the
 * two locations (GET /locations, for the live pollers and directions) and
 * the membership program (the rewards teaser's figures). Both fail soft.
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Arrive } from "@/components/site/home/Arrive";
import { NoTip } from "@/components/site/home/NoTip";
import { RedStep } from "@/components/site/home/RedStep";
import { RewardsTeaser } from "@/components/site/home/RewardsTeaser";
import { TheBowl } from "@/components/site/home/TheBowl";
import { ThePod } from "@/components/site/home/ThePod";
import { TwoLocations } from "@/components/site/home/TwoLocations";
import { WalkIn } from "@/components/site/home/WalkIn";
import { getHomeLocations } from "@/lib/site/home-locations";
import { getProgram } from "@/lib/site/program";
import { RouteIntl } from "@/components/site/ScopedIntl";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home.meta");
  return { title: t("title"), description: t("description") };
}

export default async function HomePage() {
  const locale = await getLocale();
  const [locations, program] = await Promise.all([getHomeLocations(), getProgram()]);

  return (
    // Task G2b: the home page has no route segment, so it scopes its own messages.
    <RouteIntl route="home">
    <div data-home className="overflow-x-clip">
      <Arrive locale={locale} locations={locations} />
      <WalkIn />
      <ThePod />
      <TheBowl locale={locale} />
      <NoTip locale={locale} />
      <RedStep locale={locale} />
      <RewardsTeaser locale={locale} program={program} />
      <TwoLocations locale={locale} locations={locations} />
    </div>
    </RouteIntl>
  );
}
