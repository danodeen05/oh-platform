"use client";

import Image from "next/image";
import Link from "next/link";

export default function SmsConsentPage() {
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
          SMS Opt-In Consent Workflow
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
          Documentation of Oh&apos;s SMS messaging consent process for toll-free verification
        </p>
      </section>

      {/* Content */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "40px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          }}
        >
          {/* Overview */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Overview
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Oh Beef Noodle Soup uses SMS messaging to send transactional order updates to customers
            who explicitly opt-in. We collect consent through a clear, unchecked checkbox that customers
            must actively select to receive text messages.
          </p>

          {/* Consent Language */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Consent Language
          </h2>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <p style={{ color: "#222", fontStyle: "italic", lineHeight: "1.8", margin: 0 }}>
              &ldquo;I agree to receive SMS text messages from Oh Beef Noodle Soup regarding my order (confirmation &amp;
              ready-for-pickup alerts). Message frequency varies. Msg &amp; data rates may apply.
              Reply STOP to unsubscribe.&rdquo;
            </p>
          </div>

          {/* Message Types */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Message Types
          </h2>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}><strong>Order Confirmation:</strong> Sent immediately after order placement with order number and details</li>
            <li style={{ marginBottom: "8px" }}><strong>Ready for Pickup:</strong> Sent when the order is ready to be picked up</li>
          </ul>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "32px" }}>
            Message frequency: 1-2 messages per order. We do not send marketing or promotional messages.
          </p>

          {/* Opt-In Flow 1: Guest Checkout */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-In Flow #1: Guest Checkout
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            During guest checkout, when a customer enters their phone number, an unchecked checkbox
            appears allowing them to opt-in to SMS updates. The checkbox is NOT pre-checked &mdash;
            customers must actively select it to consent.
          </p>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "32px",
              textAlign: "center",
            }}
          >
            <Image
              src="/sms-consent/checkout-sms-consent.png"
              alt="SMS consent checkbox during guest checkout"
              width={600}
              height={400}
              style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", border: "1px solid #ddd" }}
            />
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "12px", marginBottom: 0 }}>
              Screenshot: SMS consent checkbox on payment page (guest checkout)
            </p>
          </div>

          {/* Opt-In Flow 2: Phone Collection Modal */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-In Flow #2: Phone Collection Modal
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            For logged-in customers without a phone number on file, a modal appears on the order
            confirmation page giving them the option to add their phone number and consent to SMS updates.
          </p>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "32px",
              textAlign: "center",
            }}
          >
            <Image
              src="/sms-consent/phone-modal-consent.png"
              alt="Phone collection modal with SMS consent"
              width={600}
              height={400}
              style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", border: "1px solid #ddd" }}
            />
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "12px", marginBottom: 0 }}>
              Screenshot: Phone collection modal with SMS consent checkbox
            </p>
          </div>

          {/* Opt-Out Process */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-Out Process
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Customers can opt out at any time by replying <strong>STOP</strong> to any SMS message.
            This is handled automatically by our messaging provider (Twilio). We also honor opt-out
            requests sent to our customer service email.
          </p>

          {/* Privacy Policy Link */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Privacy Policy
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Our complete privacy policy, including our SMS messaging practices, is available at:{" "}
            <Link href="/privacy" style={{ color: "#7C7A67", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
          </p>

          {/* Contact */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Contact Information
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "8px" }}>
            <strong>Business Name:</strong> Oh Beef Noodle Soup LLC
          </p>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "8px" }}>
            <strong>Website:</strong> eatoh.com
          </p>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "8px" }}>
            <strong>Contact Email:</strong> hello@eatoh.com
          </p>
        </div>
      </section>
    </div>
  );
}
