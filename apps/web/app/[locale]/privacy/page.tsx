"use client";

import Link from "next/link";

export default function PrivacyPage() {
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
          Privacy Policy
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
          Your privacy matters to us. Learn how we collect, use, and protect your information.
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
            Last Updated: December 2024
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Introduction
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Oh! Beef Noodle Soup (&quot;Oh!&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy and is committed to protecting your personal data. This privacy policy explains how we collect, use, disclose, and safeguard your information when you visit our website, mobile application, and physical locations.
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Information We Collect
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            We may collect information about you in a variety of ways:
          </p>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
            Personal Data
          </h3>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Name, email address, and phone number</li>
            <li style={{ marginBottom: "8px" }}>Billing and delivery address</li>
            <li style={{ marginBottom: "8px" }}>Payment information (processed securely through third-party providers)</li>
            <li style={{ marginBottom: "8px" }}>Account credentials</li>
            <li style={{ marginBottom: "8px" }}>Order history and preferences</li>
          </ul>

          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
            Automatically Collected Data
          </h3>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Device information (browser type, operating system)</li>
            <li style={{ marginBottom: "8px" }}>IP address and location data</li>
            <li style={{ marginBottom: "8px" }}>Usage patterns and browsing behavior</li>
            <li style={{ marginBottom: "8px" }}>Cookies and similar tracking technologies</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            How We Use Your Information
          </h2>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Process and fulfill your orders</li>
            <li style={{ marginBottom: "8px" }}>Manage your account and provide customer support</li>
            <li style={{ marginBottom: "8px" }}>Send order confirmations and updates</li>
            <li style={{ marginBottom: "8px" }}>Personalize your experience and preferences</li>
            <li style={{ marginBottom: "8px" }}>Administer loyalty programs and referral rewards</li>
            <li style={{ marginBottom: "8px" }}>Send promotional communications (with your consent)</li>
            <li style={{ marginBottom: "8px" }}>Improve our products, services, and website</li>
            <li style={{ marginBottom: "8px" }}>Prevent fraud and ensure security</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Sharing Your Information
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            We may share your information with:
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}><strong>Service Providers:</strong> Payment processors, delivery partners, and technology providers who help us operate our business</li>
            <li style={{ marginBottom: "8px" }}><strong>Business Partners:</strong> With your consent, for joint marketing or promotional activities</li>
            <li style={{ marginBottom: "8px" }}><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
          </ul>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            We do not sell your personal information to third parties.
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Data Security
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Your Rights
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            Depending on your location, you may have the following rights:
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}>Access and receive a copy of your personal data</li>
            <li style={{ marginBottom: "8px" }}>Correct inaccurate or incomplete information</li>
            <li style={{ marginBottom: "8px" }}>Delete your personal data</li>
            <li style={{ marginBottom: "8px" }}>Object to or restrict certain processing</li>
            <li style={{ marginBottom: "8px" }}>Data portability</li>
            <li style={{ marginBottom: "8px" }}>Withdraw consent at any time</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Cookies
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            We use cookies and similar technologies to enhance your experience, analyze usage, and assist with marketing. You can manage cookie preferences through your browser settings.
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Children&apos;s Privacy
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </p>

          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Changes to This Policy
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last Updated&quot; date.
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
              Contact Us
            </h3>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "16px" }}>
              If you have questions about this privacy policy or our practices, please contact us:
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <span style={{ color: "#666" }}>Email: </span>
                <a href="mailto:privacy@ohbeefnoodlesoup.com" style={{ color: "#7C7A67", fontWeight: "500" }}>
                  privacy@ohbeefnoodlesoup.com
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
