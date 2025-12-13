"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const openPositions = [
  {
    title: "General Manager",
    location: "San Francisco, CA",
    type: "Full-time",
    department: "Operations",
    description: "Lead our flagship location and build the team that will define the Oh! experience.",
  },
  {
    title: "Kitchen Manager",
    location: "San Francisco, CA",
    type: "Full-time",
    department: "Culinary",
    description: "Oversee kitchen operations and maintain the highest quality standards for our signature dishes.",
  },
  {
    title: "Line Cook",
    location: "San Francisco, CA",
    type: "Full-time",
    department: "Culinary",
    description: "Prepare our signature beef noodle soup and other menu items with precision and care.",
  },
  {
    title: "Service Team Member",
    location: "San Francisco, CA",
    type: "Full-time / Part-time",
    department: "Operations",
    description: "Ensure every guest has a seamless, memorable experience from arrival to departure.",
  },
  {
    title: "Software Engineer",
    location: "Remote",
    type: "Full-time",
    department: "Technology",
    description: "Build and maintain our tech-first dining platform, from ordering to operations.",
  },
];

export default function CareersPage() {
  const t = useTranslations("careers");
  const tCommon = useTranslations("common");

  const values = [
    {
      emoji: "🎯",
      title: t("values.excellence.title"),
      description: t("values.excellence.description"),
    },
    {
      emoji: "🚀",
      title: t("values.innovation.title"),
      description: t("values.innovation.description"),
    },
    {
      emoji: "🤝",
      title: t("values.team.title"),
      description: t("values.team.description"),
    },
    {
      emoji: "💪",
      title: t("values.growth.title"),
      description: t("values.growth.description"),
    },
  ];

  const benefits = [
    { emoji: "💰", title: t("benefits.pay.title"), description: t("benefits.pay.description") },
    { emoji: "🏥", title: t("benefits.health.title"), description: t("benefits.health.description") },
    { emoji: "🍜", title: t("benefits.meals.title"), description: t("benefits.meals.description") },
    { emoji: "📈", title: t("benefits.careerGrowth.title"), description: t("benefits.careerGrowth.description") },
    { emoji: "📚", title: t("benefits.learning.title"), description: t("benefits.learning.description") },
    { emoji: "🎉", title: t("benefits.events.title"), description: t("benefits.events.description") },
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
            maxWidth: "650px",
            margin: "0 auto 32px",
            lineHeight: "1.8",
            opacity: 0.9,
            fontWeight: "300",
          }}
        >
          {t("description")}
        </p>
        <a
          href="#positions"
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#C7A878",
            color: "#222222",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
          }}
        >
          {t("viewPositions")}
        </a>
      </section>

      {/* Our Values */}
      <section style={{ padding: "80px 24px", background: "white" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {t("values.title")}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "48px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto 48px",
            }}
          >
            {t("values.description")}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "32px",
            }}
          >
            {values.map((value) => (
              <div
                key={value.title}
                style={{
                  padding: "32px",
                  background: "#f9fafb",
                  borderRadius: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>{value.emoji}</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                  {value.title}
                </h3>
                <p style={{ color: "#666", lineHeight: "1.6", fontSize: "0.95rem" }}>
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="positions" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "48px",
              textAlign: "center",
            }}
          >
            {t("openPositions")}
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            {openPositions.map((position, idx) => (
              <div
                key={idx}
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <span
                      style={{
                        background: "rgba(124, 122, 103, 0.1)",
                        color: "#7C7A67",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "500",
                      }}
                    >
                      {position.department}
                    </span>
                    <span
                      style={{
                        background: "rgba(199, 168, 120, 0.2)",
                        color: "#7C7A67",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "500",
                      }}
                    >
                      {position.type}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "4px" }}>
                    {position.title}
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                    {position.location}
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "#666", lineHeight: "1.5" }}>
                    {position.description}
                  </p>
                </div>
                <button
                  style={{
                    padding: "12px 24px",
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("applyNow")}
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              background: "rgba(199, 168, 120, 0.15)",
              borderRadius: "12px",
              textAlign: "center",
              border: "1px solid rgba(199, 168, 120, 0.3)",
            }}
          >
            <p style={{ color: "#222222", margin: 0 }}>
              {t("positions.noFit")} <strong>{t("positions.alwaysLooking")}</strong>{" "}
              <Link href="/contact" style={{ color: "#7C7A67", fontWeight: "600" }}>
                {t("positions.sendResume")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ background: "#222222", color: "#E5E5E5", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "300",
              marginBottom: "48px",
              textAlign: "center",
              letterSpacing: "1px",
            }}
          >
            {t("benefits.title")}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "24px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "12px" }}>{benefit.emoji}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "8px" }}>
                  {benefit.title}
                </h3>
                <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: "#C7A878",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: "400",
            color: "#222222",
            marginBottom: "16px",
          }}
        >
          {t("cta.title")}
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#222222",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          {t("cta.description")}
        </p>
        <a
          href="#positions"
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#222222",
            color: "#E5E5E5",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
          }}
        >
          {t("cta.button")}
        </a>
      </section>
    </div>
  );
}
