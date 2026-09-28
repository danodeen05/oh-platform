"use client";

import { useTranslations } from "next-intl";
import ReferralDashboard from "./referral-dashboard";

export default function ReferralPage() {
  const t = useTranslations("referral");

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
        <p style={{ color: "#666", fontSize: "1.1rem" }}>
          {t("subtitle")}
        </p>
      </div>

      <ReferralDashboard />

      <div
        style={{
          marginTop: 64,
          padding: 32,
          background: "#f9fafb",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginBottom: 16 }}>{t("howItWorks")}</h2>
        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#7C7A67",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {t("step1.title")}
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                {t("step1.description")}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#7C7A67",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {t("step2.title")}
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                {t("step2.description")}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#7C7A67",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {t("step3.title")}
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                {t("step3.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Fine Print */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "rgba(124, 122, 103, 0.1)",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          <strong style={{ color: "#222" }}>{t("goodToKnow")}</strong>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
            <li>{t("rules.minimumOrder")}</li>
            <li>{t("rules.disbursement")}</li>
            <li>{t("rules.maxPerOrder")}</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
