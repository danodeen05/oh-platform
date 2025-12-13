"use client";

import { useTranslations } from "next-intl";

const pressReleases = [
  {
    date: "Coming Soon",
    title: "Oh! Beef Noodle Soup Announces San Francisco Flagship Location",
    excerpt: "Tech-forward restaurant concept brings private dining pods and 30-year family recipe to SOMA district.",
  },
];

export default function PressPage() {
  const t = useTranslations("press");

  const brandAssets = [
    { name: t("brandAssets.logoPackage.name"), description: t("brandAssets.logoPackage.description"), icon: "🎨" },
    { name: t("brandAssets.brandGuidelines.name"), description: t("brandAssets.brandGuidelines.description"), icon: "📐" },
    { name: t("brandAssets.productPhotography.name"), description: t("brandAssets.productPhotography.description"), icon: "📸" },
    { name: t("brandAssets.locationPhotos.name"), description: t("brandAssets.locationPhotos.description"), icon: "🏠" },
  ];

  const keyFacts = [
    { label: t("keyFacts.founded"), value: "2024" },
    { label: t("keyFacts.headquarters"), value: "San Francisco, CA" },
    { label: t("keyFacts.flagshipOpening"), value: "Spring 2025" },
    { label: t("keyFacts.recipeHeritage"), value: "30+ Years" },
    { label: t("keyFacts.uniqueFeature"), value: "Private Dining Pods" },
    { label: t("keyFacts.techPlatform"), value: "Mobile-First Ordering" },
  ];

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

      {/* Media Contact */}
      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "40px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
            textAlign: "center",
            marginBottom: "48px",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "16px" }}>
            {t("mediaContact.title")}
          </h2>
          <p style={{ color: "#666", marginBottom: "24px", lineHeight: "1.6" }}>
            {t("mediaContact.description")}
          </p>
          <a
            href="mailto:press@ohbeefnoodlesoup.com"
            style={{
              display: "inline-block",
              padding: "16px 40px",
              background: "#7C7A67",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            press@ohbeefnoodlesoup.com
          </a>
          <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "16px" }}>
            {t("mediaContact.responseTime")}
          </p>
        </div>

        {/* Our Story */}
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            {t("ourStory.title")}
          </h2>
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
            }}
          >
            <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
              {t("ourStory.p1")}
            </p>
            <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
              {t("ourStory.p2")}
            </p>
            <p style={{ color: "#444", lineHeight: "1.8" }}>
              {t("ourStory.p3")}
            </p>
          </div>
        </div>

        {/* Key Facts */}
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            {t("keyFacts.title")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {keyFacts.map((fact) => (
              <div
                key={fact.label}
                style={{
                  background: "white",
                  padding: "20px 24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "4px" }}>
                  {fact.label}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222" }}>
                  {fact.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Press Releases */}
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            {t("pressReleases.title")}
          </h2>
          <div style={{ display: "grid", gap: "16px" }}>
            {pressReleases.map((release, idx) => (
              <div
                key={idx}
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#C7A878", fontWeight: "500", marginBottom: "8px" }}>
                  {release.date}
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "8px" }}>
                  {release.title}
                </h3>
                <p style={{ color: "#666", fontSize: "0.95rem", lineHeight: "1.6" }}>
                  {release.excerpt}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Assets */}
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            {t("brandAssets.title")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {brandAssets.map((asset) => (
              <div
                key={asset.name}
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontSize: "2rem" }}>{asset.icon}</div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", marginBottom: "4px" }}>
                    {asset.name}
                  </h3>
                  <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: "1.5" }}>
                    {asset.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "#666", marginTop: "24px", fontSize: "0.9rem" }}>
            {t("brandAssets.requestAccess")}{" "}
            <a href="mailto:press@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
              press@ohbeefnoodlesoup.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
