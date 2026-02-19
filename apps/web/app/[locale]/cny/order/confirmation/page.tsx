"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AnimatedBackground } from "@/components/cny/AnimatedBackground";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || "----";
  const qrCode = searchParams.get("qrCode");

  return (
    <div className="cny-page cny-page-3">
      <AnimatedBackground theme="gold" />

      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "0 24px",
        }}
      >
        {/* Success Icon */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(34, 197, 94, 0.4)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1
          className="cny-heading"
          style={{
            fontSize: "clamp(1.2rem, 5vw, 1.6rem)",
            marginBottom: "0",
            marginTop: "-4px",
            color: "#D7B66E",
            textAlign: "center",
          }}
        >
          Order Placed!
        </h1>

        {/* Order Number */}
        <div
          style={{
            background: "rgba(215, 182, 110, 0.2)",
            borderRadius: "12px",
            padding: "12px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "rgba(215, 182, 110, 0.7)",
              fontFamily: "'Raleway', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Your Order Number
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(1.5rem, 6vw, 2rem)",
              fontWeight: 700,
              color: "#D7B66E",
              fontFamily: "'Raleway', sans-serif",
              letterSpacing: "2px",
            }}
          >
            #{orderNumber}
          </p>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            padding: "20px 24px",
            maxWidth: "350px",
            width: "100%",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#D7B66E",
              fontFamily: "'Raleway', sans-serif",
              textAlign: "center",
            }}
          >
            What happens next?
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#D7B66E",
                  color: "#910C1E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "rgba(215, 182, 110, 0.9)",
                  fontFamily: "'Raleway', sans-serif",
                  lineHeight: 1.4,
                }}
              >
                Find a seat and relax - no assigned seating tonight!
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#D7B66E",
                  color: "#910C1E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "rgba(215, 182, 110, 0.9)",
                  fontFamily: "'Raleway', sans-serif",
                  lineHeight: 1.4,
                }}
              >
                We're preparing your bowl fresh in the kitchen
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#D7B66E",
                  color: "#910C1E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "rgba(215, 182, 110, 0.9)",
                  fontFamily: "'Raleway', sans-serif",
                  lineHeight: 1.4,
                }}
              >
                We'll call your name when your bowl is ready.
              </p>
            </div>
          </div>
        </div>

        {/* Track Order Button */}
        {qrCode && (
          <a
            href={`/en/cny/order/status?qrCode=${qrCode}`}
            className="cny-button"
            style={{
              textDecoration: "none",
              marginTop: "8px",
            }}
          >
            Track My Order
          </a>
        )}

        {/* Horse mascot */}
        <img
          src="/cny/horse.svg"
          alt="Year of the Horse"
          className="cny-horse-animated"
          style={{
            marginTop: "16px",
            width: "clamp(150px, 40vw, 220px)",
            maxWidth: "50vw",
            height: "auto",
          }}
        />
      </div>
    </div>
  );
}

export default function CNYOrderConfirmation() {
  return (
    <Suspense
      fallback={
        <div className="cny-page cny-page-3">
          <AnimatedBackground theme="gold" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <p style={{ color: "#D7B66E", fontSize: "1.2rem" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
