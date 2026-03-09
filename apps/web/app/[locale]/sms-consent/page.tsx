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
          Documentation of Oh Beef Noodle Soup&apos;s SMS messaging consent process
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
            who explicitly opt-in. We collect consent through a <strong>clear, unchecked checkbox</strong> that customers
            must actively select to receive text messages. <strong>Consent is not required to make a purchase.</strong>
          </p>

          {/* Key Compliance Points */}
          <div
            style={{
              background: "#f0fdf4",
              border: "2px solid #22c55e",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "32px",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#15803d", marginBottom: "12px" }}>
              Key Compliance Points
            </h3>
            <ul style={{ color: "#166534", lineHeight: "1.8", margin: 0, paddingLeft: "20px" }}>
              <li>Checkbox is <strong>unchecked by default</strong> &mdash; requires active opt-in</li>
              <li>Consent is <strong>separate from purchase</strong> &mdash; not required to complete order</li>
              <li>Clear disclosure of message types, frequency, and data rates</li>
              <li>STOP/HELP keywords prominently displayed</li>
              <li>Link to Privacy Policy provided alongside consent</li>
            </ul>
          </div>

          {/* Consent Language */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Exact Consent Language
          </h2>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "12px" }}>
            The following text is displayed next to the opt-in checkbox:
          </p>
          <div
            style={{
              background: "#fffbeb",
              border: "2px solid #f59e0b",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <p style={{ color: "#222", fontWeight: "500", lineHeight: "1.8", margin: 0, fontSize: "1.05rem" }}>
              &ldquo;I agree to receive SMS text messages from Oh Beef Noodle Soup regarding my order (confirmation &amp;
              ready-for-pickup alerts). Message frequency varies. Msg &amp; data rates may apply.
              Reply STOP to unsubscribe.&rdquo;
            </p>
          </div>

          {/* Message Types */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Message Types (Transactional Only)
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            We only send transactional messages related to customer orders. <strong>We do not send marketing, promotional, or advertising messages.</strong>
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}><strong>Order Confirmation:</strong> Sent immediately after order placement with order number</li>
            <li style={{ marginBottom: "8px" }}><strong>Ready for Pickup:</strong> Sent when the order is ready to be picked up at the restaurant</li>
          </ul>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "32px",
            }}
          >
            <p style={{ color: "#444", margin: 0 }}>
              <strong>Message Frequency:</strong> 1-2 messages per order (one confirmation, one pickup notification)
            </p>
          </div>

          {/* Opt-In Flow 1: Guest Checkout */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-In Flow #1: Guest Checkout
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            During guest checkout on the payment page, when a customer enters their phone number, an <strong>unchecked checkbox</strong> appears
            allowing them to opt-in to SMS updates. The checkbox is <strong>NOT pre-checked</strong> &mdash;
            customers must actively click/tap the checkbox to consent. The phone number field is optional and SMS consent is not required to complete the purchase.
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
              src="/sms-consent/Opt-In1.png"
              alt="SMS consent checkbox during guest checkout - unchecked by default"
              width={600}
              height={400}
              style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", border: "1px solid #ddd" }}
            />
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "12px", marginBottom: 0 }}>
              Screenshot: Guest checkout payment page with SMS consent checkbox (unchecked by default)
            </p>
          </div>

          {/* Opt-In Flow 2: Phone Collection Modal */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-In Flow #2: Logged-In User Phone Collection
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            For logged-in customers who do not have a phone number saved in their account, a modal appears on the order
            confirmation page (after successful payment) giving them the <strong>optional</strong> opportunity to add their phone number and consent to SMS updates.
            This modal can be dismissed by clicking &ldquo;Skip for now&rdquo; &mdash; providing a phone number is not required.
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
              src="/sms-consent/Opt-In2.png"
              alt="Phone collection modal with SMS consent checkbox for logged-in users"
              width={600}
              height={400}
              style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", border: "1px solid #ddd" }}
            />
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "12px", marginBottom: 0 }}>
              Screenshot: Phone collection modal for logged-in users with SMS consent checkbox (unchecked by default)
            </p>
          </div>

          {/* Opt-Out Process */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Opt-Out Process
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "16px" }}>
            Customers can opt out at any time using the following methods:
          </p>
          <ul style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px", paddingLeft: "24px" }}>
            <li style={{ marginBottom: "8px" }}><strong>Reply STOP:</strong> Text STOP to any message to immediately unsubscribe (handled automatically by Twilio)</li>
            <li style={{ marginBottom: "8px" }}><strong>Reply HELP:</strong> Text HELP for assistance and opt-out instructions</li>
            <li style={{ marginBottom: "8px" }}><strong>Email:</strong> Contact hello@eatoh.com to request removal from SMS list</li>
          </ul>

          {/* Privacy Policy Link */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Privacy Policy
          </h2>
          <p style={{ color: "#444", lineHeight: "1.8", marginBottom: "24px" }}>
            Our complete privacy policy, including our SMS messaging practices, is available at:{" "}
            <Link href="/privacy" style={{ color: "#7C7A67", textDecoration: "underline", fontWeight: "600" }}>
              https://ohbeef.com/privacy
            </Link>
          </p>

          {/* Contact */}
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#222222", marginBottom: "16px" }}>
            Business Contact Information
          </h2>
          <div style={{ color: "#444", lineHeight: "2" }}>
            <p style={{ margin: "0 0 4px 0" }}>
              <strong>Business Name:</strong> Oh Beef Noodle Soup LLC
            </p>
            <p style={{ margin: "0 0 4px 0" }}>
              <strong>Website:</strong> https://ohbeef.com
            </p>
            <p style={{ margin: "0 0 4px 0" }}>
              <strong>Contact Email:</strong> hello@ohbeef.com
            </p>
            <p style={{ margin: "0 0 4px 0" }}>
              <strong>SMS Phone Number:</strong> +1 (866) 359-4863
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
