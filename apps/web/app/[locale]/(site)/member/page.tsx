/**
 * Task D8: /member, the member passport (moved from (legacy) and rebuilt).
 *
 * The program (GET /membership/program) and the seal catalog (GET /badges
 * with ?locale=, names through localizedCopy: the row's i18n[locale], else
 * the English columns) are read here on the server. Everything personal
 * comes from the member's profile on the client (MemberPassport), because
 * the API only answers the signed-in member (requireSelf). Signed out, the
 * page shows a translated sign-in state (middleware no longer bounces
 * /member to Clerk's hosted page).
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MemberPassport } from "@/components/site/member/MemberPassport";
import type { CollectionSeal } from "@/components/site/member/SealCollection";
import { getBadges, getProgram, localizedCopy } from "@/lib/site/program";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("passport.meta");
  return { title: t("title"), description: t("description") };
}

export default async function MemberPage() {
  const locale = await getLocale();
  const [program, badges] = await Promise.all([getProgram(), getBadges(locale)]);
  const seals: CollectionSeal[] = badges.map((b) => ({
    slug: b.slug,
    iconKey: b.iconKey ?? b.slug,
    name: localizedCopy(b, locale).name,
  }));

  return (
    <div data-passport className="overflow-x-clip">
      <MemberPassport program={program} seals={seals} />
    </div>
  );
}
