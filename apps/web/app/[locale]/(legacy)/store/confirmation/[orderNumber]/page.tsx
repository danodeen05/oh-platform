"use client";

import { use } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export default function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = use(params);
  const locale = useLocale();

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 60px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              color: "white",
              letterSpacing: "1px",
              marginBottom: "16px",
            }}
          >
            Order Confirmed!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Thank you for your order
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Order Number */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "8px" }}>Order Number</p>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "#222",
              letterSpacing: "2px",
              fontFamily: "monospace",
            }}
          >
            {orderNumber}
          </p>
        </div>

        {/* What's Next */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
            What&apos;s Next?
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", color: "#222", marginBottom: "4px" }}>
                  Confirmation Email
                </p>
                <p style={{ fontSize: "0.9rem", color: "#666" }}>
                  We&apos;ve sent a confirmation email with your order details.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13" rx="2" />
                  <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-5" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", color: "#222", marginBottom: "4px" }}>
                  Shipping Update
                </p>
                <p style={{ fontSize: "0.9rem", color: "#666" }}>
                  We&apos;ll email you when your order ships with tracking info.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", color: "#222", marginBottom: "4px" }}>
                  Delivery
                </p>
                <p style={{ fontSize: "0.9rem", color: "#666" }}>
                  Orders typically arrive within 5-7 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link
            href={`/${locale}/store`}
            style={{
              display: "block",
              padding: "18px",
              background: "#7C7A67",
              color: "white",
              borderRadius: "12px",
              fontSize: "1.1rem",
              fontWeight: "600",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Continue Shopping
          </Link>
          <Link
            href={`/${locale}`}
            style={{
              display: "block",
              padding: "18px",
              background: "white",
              color: "#7C7A67",
              border: "2px solid #7C7A67",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: "600",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
