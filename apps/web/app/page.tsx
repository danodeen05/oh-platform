"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function HomePage() {
  const [showStaticLogo, setShowStaticLogo] = useState(false);
  const [videoFading, setVideoFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopCountRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      loopCountRef.current += 1;
      if (loopCountRef.current < 2) {
        // Play again for the second loop
        video.currentTime = 0;
        video.play();
      } else {
        // After 2 loops, fade out video and show static logo
        setVideoFading(true);
        setTimeout(() => {
          setShowStaticLogo(true);
        }, 500); // Match the fade duration
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, []);
  return (
    <div style={{ background: "#ffffff" }}>
      {/* Hero Section */}
      <section
        style={{
          minHeight: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "20px 24px 40px",
          textAlign: "center",
          position: "relative",
          background: "#ffffff",
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: "48px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Video Logo - plays twice then fades (2x size) */}
          {!showStaticLogo && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "clamp(600px, 80vw, 1200px)",
                height: "auto",
                display: "block",
                opacity: videoFading ? 0 : 1,
                transition: "opacity 0.5s ease",
              }}
            >
              <source src="/Additional Files/4K.mp4" type="video/mp4" />
            </video>
          )}
          {/* Static Logo - fades in after video (0.5x size) */}
          {showStaticLogo && (
            <img
              src="/Oh_Logo_Mark_Web.png"
              alt="Oh! Beef Noodle Soup"
              style={{
                width: "clamp(200px, 30vw, 400px)",
                height: "auto",
                display: "block",
                opacity: 0,
                animation: "fadeIn 0.5s ease forwards",
              }}
            />
          )}
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            fontWeight: "300",
            marginBottom: "24px",
            color: "#222222",
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
            color: "#7C7A67",
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
                  background: "#7C7A67",
                  color: "#ffffff",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.4s ease",
                  letterSpacing: "1px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#C7A878";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#7C7A67";
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
                background: "#7C7A67",
                color: "#ffffff",
                borderRadius: "8px",
                textDecoration: "none",
                transition: "all 0.4s ease",
                display: "inline-block",
                letterSpacing: "1px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#C7A878";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#7C7A67";
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
          background: "white",
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
                color: "#222222",
                letterSpacing: "1px",
              }}
            >
              30-Year Recipe
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
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
                color: "#222222",
                letterSpacing: "1px",
              }}
            >
              Premium Beef
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
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
              📱
            </div>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: "400",
                marginBottom: "16px",
                color: "#222222",
                letterSpacing: "1px",
              }}
            >
              Tech-First Experience
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              Order ahead, earn rewards, and enjoy seamless service
            </p>
          </div>
        </div>
      </section>

      {/* Private Pods Section */}
      <section
        style={{
          padding: "100px 24px",
          background: "#222222",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "4rem",
              marginBottom: "24px",
            }}
          >
            🚪
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "24px",
              color: "#E5E5E5",
              letterSpacing: "1px",
            }}
          >
            Private Dining Pods
          </h2>
          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
              color: "#C7A878",
              lineHeight: "1.8",
              fontWeight: "300",
              marginBottom: "32px",
              maxWidth: "700px",
              margin: "0 auto 32px",
            }}
          >
            Experience dining like never before. Our individual pods offer a peaceful,
            distraction-free space to savor every slurp. No crowded tables, no noise —
            just you and your perfect bowl of beef noodle soup.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "32px",
              marginTop: "48px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🎧</div>
              <h4 style={{ color: "#E5E5E5", fontWeight: "400", marginBottom: "8px" }}>
                Your Space
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                Personal pod with ambient lighting and music controls
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔕</div>
              <h4 style={{ color: "#E5E5E5", fontWeight: "400", marginBottom: "8px" }}>
                Zero Distractions
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                Focus on your meal without the bustle of traditional dining
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚡</div>
              <h4 style={{ color: "#E5E5E5", fontWeight: "400", marginBottom: "8px" }}>
                Fast & Fresh
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                Food delivered directly to your pod, hot and ready
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* No Tipping Section */}
      <section
        style={{
          padding: "100px 24px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "4rem",
              marginBottom: "24px",
            }}
          >
            💯
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "24px",
              color: "#222222",
              letterSpacing: "1px",
            }}
          >
            No Tipping. Ever.
          </h2>
          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
              color: "#7C7A67",
              lineHeight: "1.8",
              fontWeight: "300",
              maxWidth: "700px",
              margin: "0 auto 32px",
            }}
          >
            At Oh!, the price you see is the price you pay. We believe our team deserves
            fair, stable wages — not unpredictable tips. That's why we pay our kitchen and
            cleaning staff competitive salaries with benefits.
          </p>
          <div
            style={{
              display: "inline-block",
              background: "white",
              borderRadius: "12px",
              padding: "24px 40px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "32px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>✓</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem", fontWeight: "500" }}>
                  Fair wages for all
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>✓</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem", fontWeight: "500" }}>
                  No awkward math
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>✓</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem", fontWeight: "500" }}>
                  Simple checkout
                </p>
              </div>
            </div>
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
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
