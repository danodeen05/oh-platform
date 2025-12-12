"use client";

import Link from "next/link";

export default function AccessibilityPage() {
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
          Accessibility
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
          We&apos;re committed to making Oh! Beef Noodle Soup accessible to everyone.
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
            Our Commitment
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            At Oh! Beef Noodle Soup, we believe everyone deserves to enjoy the perfect bowl of beef noodle soup. We are committed to ensuring our digital platforms and physical locations are accessible to people of all abilities.
          </p>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Website Accessibility
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            We strive to ensure our website meets WCAG 2.1 Level AA standards. Our ongoing accessibility efforts include:
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Keyboard navigation support for all interactive elements</li>
            <li style={{ marginBottom: "8px" }}>Clear and consistent heading structure</li>
            <li style={{ marginBottom: "8px" }}>Sufficient color contrast ratios</li>
            <li style={{ marginBottom: "8px" }}>Alternative text for images</li>
            <li style={{ marginBottom: "8px" }}>Responsive design for all devices</li>
            <li style={{ marginBottom: "8px" }}>Screen reader compatibility</li>
          </ul>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Restaurant Accessibility
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            Our physical locations are designed with accessibility in mind:
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Wheelchair accessible entrances and dining areas</li>
            <li style={{ marginBottom: "8px" }}>ADA-compliant restroom facilities</li>
            <li style={{ marginBottom: "8px" }}>Accessible private dining pods</li>
            <li style={{ marginBottom: "8px" }}>Clear signage and wayfinding</li>
            <li style={{ marginBottom: "8px" }}>Assistance available upon request</li>
          </ul>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Ordering Assistance
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            If you need assistance placing an order or have questions about our accessibility features, our team is happy to help. Contact us at{" "}
            <a href="mailto:hello@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
              hello@ohbeefnoodlesoup.com
            </a>
            .
          </p>

          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Feedback
          </h3>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            We welcome your feedback on the accessibility of Oh! Beef Noodle Soup. Please let us know if you encounter any accessibility barriers or have suggestions for improvement.
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
              Contact Us About Accessibility
            </h4>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "16px" }}>
              If you have questions or concerns about accessibility, please reach out:
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <span style={{ color: "#666" }}>Email: </span>
                <a href="mailto:accessibility@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  accessibility@ohbeefnoodlesoup.com
                </a>
              </div>
              <div>
                <span style={{ color: "#666" }}>Or use our </span>
                <Link href="/contact" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  contact form
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
