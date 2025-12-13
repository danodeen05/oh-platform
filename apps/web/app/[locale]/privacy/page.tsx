"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");
  const tCommon = useTranslations("common");

  return (
    <div style={{ background: "#E5E5E5", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(180deg, #222222 0%, #333333 100%)",
          color: "#E5E5E5",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: "300",
            marginBottom: "16px",
            letterSpacing: "2px",
            color: "#E5E5E5",
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.8",
            opacity: 0.9,
            fontWeight: "300",
          }}
        >
          {t("description")}
        </p>
      </section>

      {/* Content */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "40px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          }}
        >
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "32px" }}>
            {t("lastUpdated")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.introduction.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.introduction.content")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.infoCollect.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            {t("sections.infoCollect.intro")}
          </p>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
            {t("sections.infoCollect.personalData.title")}
          </h3>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("sections.infoCollect.personalData.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
            {t("sections.infoCollect.autoData.title")}
          </h3>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("sections.infoCollect.autoData.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.howWeUse.title")}
          </h2>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("sections.howWeUse.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.sharing.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            {t("sections.sharing.intro")}
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}><strong>Service Providers:</strong> {t("sections.sharing.serviceProviders")}</li>
            <li style={{ marginBottom: "8px" }}><strong>Business Partners:</strong> {t("sections.sharing.businessPartners")}</li>
            <li style={{ marginBottom: "8px" }}><strong>Legal Requirements:</strong> {t("sections.sharing.legalRequirements")}</li>
          </ul>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.sharing.noSell")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.security.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.security.content")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.rights.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            {t("sections.rights.intro")}
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("sections.rights.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.cookies.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.cookies.content")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.children.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.children.content")}
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("sections.changes.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("sections.changes.content")}
          </p>

          <div
            style={{
              background: "#f9fafb",
              padding: "24px",
              borderRadius: "12px",
              marginTop: "32px",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
              {t("sections.contactUs.title")}
            </h3>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "16px" }}>
              {t("sections.contactUs.intro")}
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <span style={{ color: "#666" }}>{tCommon("email")}: </span>
                <a href="mailto:privacy@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  privacy@ohbeefnoodlesoup.com
                </a>
              </div>
              <div>
                <span style={{ color: "#666" }}>{tCommon("or")} </span>
                <Link href="/contact" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  {tCommon("contactForm")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
