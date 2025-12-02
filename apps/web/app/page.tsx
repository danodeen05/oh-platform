"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ background: "#ffffff" }}>
      {/* Hero Section */}
      <section
        style={{
          minHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Logo Animation */}
        <div
          style={{
            width: "clamp(400px, 60vw, 600px)",
            marginBottom: "32px",
            opacity: 0,
            animation: "fadeInUp 1.2s ease forwards",
          }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          >
            <source src="/Additional Files/4K.mp4" type="video/mp4" />
          </video>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            fontWeight: "300",
            marginBottom: "24px",
            color: "#2a2a2a",
            letterSpacing: "2px",
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.2s forwards",
          }}
        >
          <span style={{ fontFamily: '"Noto Serif TC", serif' }}>哦</span> Oh! Beef Noodle Soup
        </h1>

        <p
          style={{
            fontSize: "clamp(1rem, 3vw, 1.3rem)",
            marginBottom: "56px",
            maxWidth: "700px",
            lineHeight: "1.8",
            color: "#666",
            fontWeight: "300",
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.5s forwards",
          }}
        >
          Order ahead. Skip the wait. Enjoy premium beef noodles in private
          dining cubicles.
        </p>

        <div
          style={{
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.8s forwards",
          }}
        >
          <SignedOut>
            <SignInButton mode="modal">
              <button
                style={{
                  padding: "18px 56px",
                  fontSize: "1.1rem",
                  fontWeight: "400",
                  background: "#2a2a2a",
                  color: "#ffffff",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.4s ease",
                  letterSpacing: "1px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1a1a1a";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2a2a2a";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                SIGN IN TO ORDER
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/order"
              style={{
                padding: "18px 56px",
                fontSize: "1.1rem",
                fontWeight: "400",
                background: "#2a2a2a",
                color: "#ffffff",
                borderRadius: "4px",
                textDecoration: "none",
                transition: "all 0.4s ease",
                display: "inline-block",
                letterSpacing: "1px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a1a1a";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              ORDER NOW
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: "120px 24px",
          background: "#f9f9f9",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "64px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "32px",
              transition: "transform 0.5s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-8px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "24px",
                opacity: 0.9,
              }}
            >
              🍜
            </div>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: "400",
                marginBottom: "16px",
                color: "#2a2a2a",
                letterSpacing: "1px",
              }}
            >
              30-Year Recipe
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#666",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              Perfected beef noodle soup, passed down through generations
            </p>
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "32px",
              transition: "transform 0.5s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-8px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "24px",
                opacity: 0.9,
              }}
            >
              🥩
            </div>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: "400",
                marginBottom: "16px",
                color: "#2a2a2a",
                letterSpacing: "1px",
              }}
            >
              Premium Beef
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#666",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              A5 Wagyu and premium cuts sourced for exceptional quality
            </p>
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "32px",
              transition: "transform 0.5s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-8px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "24px",
                opacity: 0.9,
              }}
            >
              🚀
            </div>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: "400",
                marginBottom: "16px",
                color: "#2a2a2a",
                letterSpacing: "1px",
              }}
            >
              Tech-First Experience
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#666",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              Order ahead, earn rewards, and enjoy seamless service
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
