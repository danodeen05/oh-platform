import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GateForm } from "./GateForm";

/**
 * Plan gate. Reachable without a session; everything else under /plan is
 * redirected here by middleware. Styling is inline for Phase 1 and moves to
 * the Tailwind plan tokens in Phase 3 together with the shell.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; c?: string }>;
};

function safeNext(locale: string, next: string | undefined): string {
  // Only same-origin plan paths; never an absolute URL from the query string.
  if (next && /^\/(en|zh-TW|zh-CN|es)\/plan(\/|$|\?)/.test(next)) return next;
  return `/${locale}/plan`;
}

export default async function PlanGatePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, c } = await searchParams;
  const t = await getTranslations("plan.gate");

  return (
    <main
      style={{
        minHeight: "100vh",
        flexShrink: 0,
        background: "#1C1B19",
        color: "#F2EDE4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Oh_Logo_Mark_Light.png"
          alt="Oh!"
          width={88}
          height={88}
          style={{ width: 88, height: "auto", margin: "0 auto 32px", display: "block" }}
        />
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 500,
            fontSize: "clamp(1.6rem, 5vw, 2.1rem)",
            lineHeight: 1.2,
            margin: "0 0 12px",
          }}
        >
          {t("title")}
        </h1>
        <p style={{ color: "#9A9188", margin: "0 0 32px", fontSize: "0.95rem" }}>{t("subtitle")}</p>
        <GateForm
          nextPath={safeNext(locale, next)}
          initialCode={c ?? ""}
          labels={{
            codeLabel: t("codeLabel"),
            codePlaceholder: t("codePlaceholder"),
            submit: t("submit"),
            submitting: t("submitting"),
            errorInvalid: t("errorInvalid"),
            errorRateLimited: t("errorRateLimited"),
            errorNetwork: t("errorNetwork"),
          }}
        />
        <p style={{ color: "#8A8178", marginTop: 40, fontSize: "0.8rem" }}>{t("help")}</p>
      </div>
    </main>
  );
}
