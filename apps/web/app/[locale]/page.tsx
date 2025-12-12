"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const locale = useLocale();

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
          <img
            src="/Oh_Logo_Mark_Web.png"
            alt={t("brandName")}
            style={{
              width: "clamp(200px, 30vw, 400px)",
              height: "auto",
              display: "block",
            }}
          />
        </div>

        <h1
          style={{
            fontSize: "clamp(1.8rem, 5vw, 3rem)",
            fontWeight: "400",
            marginBottom: "24px",
            color: "#222222",
            letterSpacing: "2px",
            opacity: 0,
            animation: "fadeInUp 1.2s ease 0.2s forwards",
          }}
        >
          <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: '1.2em' }}>哦</span>{" "}
          <span style={{ fontFamily: '"Bebas Neue", sans-serif' }}>{t("brandName")}</span>
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
          {t("tagline")}
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
                {tCommon("signInToOrder")}
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link
              href={`/${locale}/order`}
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
              {tCommon("orderNow")}
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
              {t("features.recipe.title")}
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              {t("features.recipe.description")}
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
              {t("features.beef.title")}
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              {t("features.beef.description")}
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
              {t("features.tech.title")}
            </h3>
            <p
              style={{
                fontSize: "1rem",
                color: "#7C7A67",
                lineHeight: "1.6",
                fontWeight: "300",
              }}
            >
              {t("features.tech.description")}
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
            {t("pods.title")}
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
            {t("pods.description")}
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
                {t("pods.features.space.title")}
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                {t("pods.features.space.description")}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔕</div>
              <h4 style={{ color: "#E5E5E5", fontWeight: "400", marginBottom: "8px" }}>
                {t("pods.features.focus.title")}
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                {t("pods.features.focus.description")}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚡</div>
              <h4 style={{ color: "#E5E5E5", fontWeight: "400", marginBottom: "8px" }}>
                {t("pods.features.fast.title")}
              </h4>
              <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.5" }}>
                {t("pods.features.fast.description")}
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
            {t("noTipping.title")}
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
            {t("noTipping.description")}
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
                  {t("noTipping.benefits.wages")}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>✓</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem", fontWeight: "500" }}>
                  {t("noTipping.benefits.math")}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>✓</div>
                <p style={{ color: "#7C7A67", fontSize: "0.9rem", fontWeight: "500" }}>
                  {t("noTipping.benefits.checkout")}
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
      `}</style>
    </div>
  );
}
