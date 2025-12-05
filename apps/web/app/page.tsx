"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div style={{ background: "#E5E5E5", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          minHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          textAlign: "center",
          position: "relative",
          background: "#E5E5E5",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: "clamp(300px, 50vw, 500px)",
            marginBottom: "48px",
            opacity: 0,
            animation: "fadeInUp 1.2s ease forwards",
          }}
        >
          <Image
            src="/Oh_Logo_Mark_Web.png"
            alt="Oh Beef Noodle Soup"
            width={500}
            height={500}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>

        {/* Tagline */}
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: "300",
            marginBottom: "24px",
            color: "#222222",
            letterSpacing: "2px",
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.2s forwards",
            fontFamily: "'Noto Serif TC', serif",
          }}
        >
          Authentic. Timeless. Crafted with Care.
        </h1>

        <p
          style={{
            fontSize: "clamp(0.95rem, 2.5vw, 1.1rem)",
            marginBottom: "56px",
            maxWidth: "600px",
            lineHeight: "1.8",
            color: "#666666",
            fontWeight: "300",
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.5s forwards",
          }}
        >
          Order ahead. Skip the wait. Experience premium beef noodle soup in an intimate,
          modern setting.
        </p>

        {/* CTA */}
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
                  fontSize: "1rem",
                  fontWeight: "400",
                  background: "#222222",
                  color: "#E5E5E5",
                  borderRadius: "2px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  letterSpacing: "1px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#7C7A67";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#222222";
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
                fontSize: "1rem",
                fontWeight: "400",
                background: "#222222",
                color: "#E5E5E5",
                borderRadius: "2px",
                textDecoration: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "inline-block",
                letterSpacing: "1px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#7C7A67";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#222222";
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
          background: "#222222",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "80px",
              color: "#E5E5E5",
              letterSpacing: "1px",
            }}
          >
            Why Oh?
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "64px",
            }}
          >
            {[
              {
                icon: "🍜",
                title: "30-Year Recipe",
                description: "Perfected beef noodle soup, passed down through generations",
              },
              {
                icon: "🥩",
                title: "Premium Beef",
                description: "A5 Wagyu and premium cuts sourced for exceptional quality",
              },
              {
                icon: "🚀",
                title: "Tech-First Experience",
                description: "Order ahead, earn rewards, and enjoy seamless service",
              },
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  textAlign: "center",
                  padding: "32px",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-8px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div
                  style={{
                    fontSize: "3.5rem",
                    marginBottom: "24px",
                    opacity: 0.9,
                  }}
                >
                  {feature.icon}
                </div>
                <h3
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "400",
                    marginBottom: "16px",
                    color: "#C7A878",
                    letterSpacing: "1px",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: "1rem",
                    color: "#999999",
                    lineHeight: "1.7",
                    fontWeight: "300",
                  }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section
        style={{
          padding: "120px 24px",
          background: "#E5E5E5",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "32px",
              color: "#222222",
              letterSpacing: "1px",
              fontFamily: "'Noto Serif TC', serif",
            }}
          >
            An Experience, Not Just a Meal
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.9",
              color: "#666666",
              fontWeight: "300",
              marginBottom: "24px",
            }}
          >
            At Oh, we blend tradition with innovation. Our beef noodle soup recipe has been
            perfected over three decades, honoring authentic Taiwanese flavors while
            embracing modern culinary techniques.
          </p>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.9",
              color: "#666666",
              fontWeight: "300",
            }}
          >
            Each bowl is crafted with care, using premium ingredients and served in private
            dining cubicles for an intimate, focused dining experience.
          </p>
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
