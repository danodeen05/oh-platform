"use client";

import Link from "next/link";

const values = [
  {
    emoji: "🎯",
    title: "Excellence in Craft",
    description: "We obsess over the details. Every bowl, every experience, every interaction matters.",
  },
  {
    emoji: "🚀",
    title: "Innovation First",
    description: "We're building the future of dining. Technology and tradition working in harmony.",
  },
  {
    emoji: "🤝",
    title: "Team Over Ego",
    description: "We succeed together. Collaboration, respect, and support are at our core.",
  },
  {
    emoji: "💪",
    title: "Growth Mindset",
    description: "We invest in our people. Learn, grow, and advance your career with us.",
  },
];

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

const benefits = [
  { emoji: "💰", title: "Competitive Pay", description: "Above-market wages plus performance bonuses" },
  { emoji: "🏥", title: "Health Benefits", description: "Medical, dental, and vision coverage" },
  { emoji: "🍜", title: "Free Meals", description: "Daily meals during shifts plus family discount" },
  { emoji: "📈", title: "Career Growth", description: "Clear advancement paths and mentorship" },
  { emoji: "📚", title: "Learning Budget", description: "Annual stipend for professional development" },
  { emoji: "🎉", title: "Team Events", description: "Regular team outings and celebrations" },
];

export default function CareersPage() {
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
          Join Our Team
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
          Help us reimagine the dining experience. We&apos;re building something special and looking for passionate people to join us on this journey.
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
          VIEW OPEN POSITIONS
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
            Our Values
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
            These principles guide everything we do, from how we make our soup to how we treat each other.
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
            Open Positions
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
                  Apply
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
              Don&apos;t see a position that fits? <strong>We&apos;re always looking for talented people.</strong>{" "}
              <Link href="/contact" style={{ color: "#7C7A67", fontWeight: "600" }}>
                Send us your resume
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
            Why Work With Us
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
          Ready to Make Your Mark?
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#222222",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          Join us in creating the future of dining.
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
          APPLY NOW
        </a>
      </section>
    </div>
  );
}
