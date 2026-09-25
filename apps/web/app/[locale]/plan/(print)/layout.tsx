import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlanSession } from "@/lib/plan/session.server";
import { planFontVariables } from "@/lib/plan/fonts";

/**
 * Print route group: same session gate as the interactive shell, no nav,
 * no beacon, light theme on paper. Sibling of (gated) so the URL stays
 * /[locale]/plan/print.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function PlanPrintLayout({ children, params }: Props) {
  const { locale } = await params;
  const claims = await getPlanSession();
  if (!claims) redirect(`/${locale}/plan/gate?next=/${locale}/plan/print`);
  return <div className={`${planFontVariables} plan-print min-h-screen shrink-0 bg-oh-paper text-oh-charcoal`}>{children}</div>;
}
