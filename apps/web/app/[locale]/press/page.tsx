"use client";

import Link from "next/link";

const pressReleases = [
  {
    date: "Coming Soon",
    title: "Oh! Beef Noodle Soup Announces San Francisco Flagship Location",
    excerpt: "Tech-forward restaurant concept brings private dining pods and 30-year family recipe to SOMA district.",
  },
];

const brandAssets = [
  { name: "Logo Package", description: "Primary logo in various formats (PNG, SVG, EPS)", icon: "🎨" },
  { name: "Brand Guidelines", description: "Color palette, typography, and usage guidelines", icon: "📐" },
  { name: "Product Photography", description: "High-resolution images of our signature dishes", icon: "📸" },
  { name: "Location Photos", description: "Interior and exterior photography of our spaces", icon: "🏠" },
];

export default function PressPage() {
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
          Press & Media
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
          Resources for journalists, bloggers, and media professionals covering Oh! Beef Noodle Soup.
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
            Media Contact
          </h2>
          <p style={{ color: "#666", marginBottom: "24px", lineHeight: "1.6" }}>
            For press inquiries, interviews, or media requests, please contact our communications team.
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
            We typically respond within 24-48 hours
          </p>
        </div>

        {/* Our Story */}
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            Our Story
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
              Oh! Beef Noodle Soup is reimagining the traditional Taiwanese dining experience through technology and thoughtful design. Founded on a 30-year family recipe, we&apos;re bringing the comfort of beef noodle soup to a new generation of diners who value quality, convenience, and unique experiences.
            </p>
            <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
              Our flagship location in San Francisco features private dining pods inspired by Japanese solo dining concepts, allowing guests to fully immerse themselves in the flavors and aromas of our handcrafted soup without distraction.
            </p>
            <p style={{ color: "#444", lineHeight: "1.8" }}>
              With a tech-first approach to ordering and service, Oh! offers a seamless dining experience from the moment you place your order through our app to the final spoonful of rich, aromatic broth.
            </p>
          </div>
        </div>

        {/* Key Facts */}
        <div style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222222", marginBottom: "24px" }}>
            Key Facts
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {[
              { label: "Founded", value: "2024" },
              { label: "Headquarters", value: "San Francisco, CA" },
              { label: "Flagship Opening", value: "Spring 2025" },
              { label: "Recipe Heritage", value: "30+ Years" },
              { label: "Unique Feature", value: "Private Dining Pods" },
              { label: "Tech Platform", value: "Mobile-First Ordering" },
            ].map((fact) => (
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
            Press Releases
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
            Brand Assets
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
            Request access to brand assets by emailing{" "}
            <a href="mailto:press@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
              press@ohbeefnoodlesoup.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
