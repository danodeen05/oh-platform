"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

const COLORS = {
  primary: "#7C7A67",
  surface: "#FFFFFF",
  text: "#1a1a1a",
  textMuted: "#666666",
  border: "#e5e5e5",
  error: "#dc2626",
  errorLight: "rgba(220, 38, 38, 0.1)",
};

export default function KioskUnauthorizedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        padding: 48,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: COLORS.errorLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.error}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 16,
          }}
        >
          Access Denied
        </h1>

        <p
          style={{
            fontSize: "1.1rem",
            color: COLORS.textMuted,
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Your account does not have permission to access the kiosk system.
          Please contact your manager if you believe this is an error.
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              padding: "12px 24px",
              background: COLORS.primary,
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Go to Homepage
          </Link>

          <SignOutButton>
            <button
              style={{
                padding: "12px 24px",
                background: "transparent",
                border: `2px solid ${COLORS.border}`,
                borderRadius: 8,
                color: COLORS.textMuted,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
