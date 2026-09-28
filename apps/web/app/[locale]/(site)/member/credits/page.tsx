/**
 * Task D8: /member/credits (moved from (legacy) and rebuilt). The program's
 * credit lifetime is read here; the balance, expiring lots and history are
 * the member's own and load on the client in CreditsHistory.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CreditsHistory } from "@/components/site/member/CreditsHistory";
import { getProgram } from "@/lib/site/program";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("passport.creditsPage");
  return { title: t("title") };
}

export default async function MemberCreditsPage() {
  const program = await getProgram();
  return <CreditsHistory expiryDays={program?.creditExpiryDays ?? 90} />;
}
