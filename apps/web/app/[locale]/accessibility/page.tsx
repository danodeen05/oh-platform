"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AccessibilityPage() {
  const t = useTranslations("accessibility");
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
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            {t("commitment.title")}
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("commitment.content")}
          </p>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("website.title")}
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            {t("website.intro")}
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("website.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("restaurant.title")}
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            {t("restaurant.intro")}
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            {(t.raw("restaurant.items") as string[]).map((item, idx) => (
              <li key={idx} style={{ marginBottom: "8px" }}>{item}</li>
            ))}
          </ul>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("ordering.title")}
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("ordering.content")}{" "}
            <a href="mailto:hello@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
              hello@ohbeefnoodlesoup.com
            </a>
            .
          </p>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            {t("feedback.title")}
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            {t("feedback.content")}
          </p>

          <div
            style={{
              background: "#f9fafb",
              padding: "24px",
              borderRadius: "12px",
              marginTop: "32px",
            }}
          >
            <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
              {t("contactUs.title")}
            </h4>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "16px" }}>
              {t("contactUs.intro")}
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <span style={{ color: "#666" }}>{tCommon("email")}: </span>
                <a href="mailto:accessibility@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  accessibility@ohbeefnoodlesoup.com
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
