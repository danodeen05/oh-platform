import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPlanSession } from "@/lib/plan/session.server";
import { redirect } from "next/navigation";
import { ClosePlanButton } from "./ClosePlanButton";

/**
 * Gated plan shell. Phase 1: verifies the session and renders a minimal
 * frame. Phase 3 replaces the frame with the nav, progress rail, and beacon.
 * Middleware already redirects unauthenticated visitors; the check here is
 * defense in depth for direct server rendering.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PlanLayout({ children, params }: Props) {
  const { locale } = await params;
  const claims = await getPlanSession();
  if (!claims) redirect(`/${locale}/plan/gate?next=/${locale}/plan`);
  const t = await getTranslations("plan.shell");

  return (
    <div style={{ minHeight: "100vh", flexShrink: 0, background: "#1C1B19", color: "#F2EDE4" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 20px",
          borderBottom: "1px solid #3A3632",
          fontSize: "0.85rem",
          color: "#9A9188",
        }}
      >
        <span>{t("viewingAs", { label: claims.lbl })}</span>
        <ClosePlanButton label={t("signOut")} locale={locale} />
      </header>
      <main style={{ padding: "32px 20px", maxWidth: 960, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
