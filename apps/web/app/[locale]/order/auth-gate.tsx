"use client";

import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useGuest } from "@/contexts/guest-context";
import { type ReactNode } from "react";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isGuest, isLoading: guestLoading, startGuestSession } = useGuest();
  const { isLoaded: clerkLoaded } = useUser();

  const handleGuestContinue = async () => {
    await startGuestSession();
  };

  // Show loading state while checking auth
  if (guestLoading || !clerkLoaded) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "300px"
      }}>
        <div style={{ color: "#7C7A67" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* If signed in with Clerk, show the content */}
      <SignedIn>{children}</SignedIn>

      {/* If not signed in with Clerk */}
      <SignedOut>
        {/* But has guest session, show content */}
        {isGuest ? (
          children
        ) : (
          /* No auth at all - show sign in / guest options */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "60vh",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: "300",
                marginBottom: "16px",
                color: "#2D2A26",
                letterSpacing: "1px",
              }}
            >
              Ready to Order?
            </h1>
            <p
              style={{
                fontSize: "1.1rem",
                color: "#7C7A67",
                marginBottom: "32px",
                maxWidth: "500px",
                lineHeight: "1.7",
              }}
            >
              Create a free account and start earning immediately.
            </p>

            {/* Benefits Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginBottom: "40px",
                maxWidth: "500px",
                width: "100%",
              }}
            >
              <div
                style={{
                  background: "rgba(199, 168, 120, 0.1)",
                  borderRadius: "12px",
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>💰</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2D2A26", marginBottom: "4px" }}>1% Cashback</div>
                <div style={{ fontSize: "0.75rem", color: "#7C7A67" }}>including this order!</div>
              </div>
              <div
                style={{
                  background: "rgba(199, 168, 120, 0.1)",
                  borderRadius: "12px",
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>🎁</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2D2A26", marginBottom: "4px" }}>$5 Referral</div>
                <div style={{ fontSize: "0.75rem", color: "#7C7A67" }}>for you & friends</div>
              </div>
              <div
                style={{
                  background: "rgba(199, 168, 120, 0.1)",
                  borderRadius: "12px",
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>⭐</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2D2A26", marginBottom: "4px" }}>Early Access</div>
                <div style={{ fontSize: "0.75rem", color: "#7C7A67" }}>new menu items</div>
              </div>
            </div>

            {/* Sign In Button - Prominent */}
            <SignInButton mode="modal">
              <button
                style={{
                  padding: "18px 56px",
                  fontSize: "1.1rem",
                  fontWeight: "500",
                  background: "linear-gradient(135deg, #C7A878 0%, #B8956A 100%)",
                  color: "#ffffff",
                  borderRadius: "50px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.4s ease",
                  letterSpacing: "2px",
                  boxShadow: "0 8px 30px rgba(199, 168, 120, 0.35)",
                  marginBottom: "24px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(199, 168, 120, 0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(199, 168, 120, 0.35)";
                }}
              >
                SIGN IN / SIGN UP
              </button>
            </SignInButton>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "24px",
                width: "100%",
                maxWidth: "300px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "rgba(124, 122, 103, 0.2)" }} />
              <span style={{ color: "#7C7A67", fontSize: "0.9rem" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(124, 122, 103, 0.2)" }} />
            </div>

            {/* Continue as Guest */}
            <button
              onClick={handleGuestContinue}
              style={{
                background: "none",
                border: "2px solid rgba(124, 122, 103, 0.3)",
                borderRadius: "50px",
                padding: "14px 40px",
                cursor: "pointer",
                color: "#5A5549",
                fontSize: "1rem",
                fontWeight: "400",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#C7A878";
                e.currentTarget.style.color = "#C7A878";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(124, 122, 103, 0.3)";
                e.currentTarget.style.color = "#5A5549";
              }}
            >
              Continue as Guest
            </button>

            <p
              style={{
                marginTop: "24px",
                fontSize: "0.85rem",
                color: "#A9A69A",
                maxWidth: "400px",
              }}
            >
              Guest checkout is quick, but you won&apos;t earn loyalty points or save your favorites.
            </p>
          </div>
        )}
      </SignedOut>
    </>
  );
}
