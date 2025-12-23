"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ background: "#FAF8F5", overflow: "hidden" }}>
      {/* Hero Section with Warm Gradient */}
      <section
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 24px 40px",
          textAlign: "center",
          position: "relative",
          background: "linear-gradient(180deg, #FAF8F5 0%, #F5F0E8 50%, #EDE4D8 100%)",
        }}
      >
        {/* Decorative warm glow */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(199, 168, 120, 0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo with gentle animation */}
        <div
          style={{
            marginBottom: "32px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            animation: "fadeInDown 1s ease 0.2s forwards",
          }}
        >
          <img
            src="/Oh_Logo_Mark_Web.png"
            alt={t("brandNamePlain")}
            style={{
              width: "clamp(180px, 25vw, 320px)",
              height: "auto",
              display: "block",
              filter: "drop-shadow(0 4px 20px rgba(124, 122, 103, 0.15))",
            }}
          />
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: "300",
            marginBottom: "20px",
            color: "#2D2A26",
            letterSpacing: "3px",
            opacity: 0,
            animation: "fadeInUp 1s ease 0.4s forwards",
          }}
        >
          {t.rich("brandName", {
            oh: (chunks) => (
              <span
                style={{
                  fontFamily: '"Ma Shan Zheng", cursive',
                  fontSize: "1.1em",
                  color: "#C7A878",
                }}
              >
                {chunks}
              </span>
            ),
            bebas: (chunks) => (
              <span
                style={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  letterSpacing: "2px",
                }}
              >
                {chunks}
              </span>
            ),
          })}
        </h1>

        <p
          style={{
            fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
            marginBottom: "16px",
            maxWidth: "600px",
            lineHeight: "1.7",
            color: "#5A5549",
            fontWeight: "300",
            fontStyle: "italic",
            opacity: 0,
            animation: "fadeInUp 1s ease 0.6s forwards",
          }}
        >
          {t.rich("tagline", {
            bold: (chunks) => <strong style={{ fontWeight: "600" }}>{chunks}</strong>
          })}
        </p>

        <p
          style={{
            fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
            marginBottom: "48px",
            maxWidth: "500px",
            lineHeight: "1.8",
            color: "#7C7A67",
            fontWeight: "300",
            opacity: 0,
            animation: "fadeInUp 1s ease 0.8s forwards",
          }}
        >
          {t("heroDescription")}
        </p>

        <div
          style={{
            opacity: 0,
            animation: "fadeInUp 1s ease 1s forwards",
          }}
        >
          <Link
            href={`/${locale}/order`}
            style={{
              padding: "20px 64px",
              fontSize: "1.1rem",
              fontWeight: "500",
              background: "linear-gradient(135deg, #C7A878 0%, #B8956A 100%)",
              color: "#ffffff",
              borderRadius: "50px",
              textDecoration: "none",
              transition: "all 0.4s ease",
              display: "inline-block",
              letterSpacing: "2px",
              boxShadow: "0 8px 30px rgba(199, 168, 120, 0.35)",
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
            {tCommon("orderNow")}
          </Link>
        </div>

        {/* Scroll indicator */}
        <div
          className="scroll-indicator"
          style={{
            position: "absolute",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            opacity: 0,
            animation: "fadeInUp 1s ease 1.5s forwards, bounce 2s ease-in-out 2.5s infinite",
          }}
        >
          <div className="scroll-indicator-inner" style={{
            width: "30px",
            height: "50px",
            border: "2px solid #C7A878",
            borderRadius: "20px",
            display: "flex",
            justifyContent: "center",
            paddingTop: "8px",
          }}>
            <div className="scroll-indicator-dot" style={{
              width: "4px",
              height: "12px",
              background: "#C7A878",
              borderRadius: "2px",
              animation: "scrollDown 1.5s ease-in-out infinite",
            }} />
          </div>
        </div>
      </section>

      {/* Food Showcase Section */}
      <section
        style={{
          padding: "100px 24px",
          background: "#2D2A26",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Warm ambient lighting effect */}
        <div style={{
          position: "absolute",
          top: "-200px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(199, 168, 120, 0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "60px",
            alignItems: "center",
          }}
        >
          {/* Left: Hero Bowl Image */}
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              transform: `translateY(${scrollY * 0.05}px)`,
            }}
          >
            <div style={{
              position: "relative",
              width: "100%",
              maxWidth: "500px",
            }}>
              {/* Glow behind bowl */}
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "120%",
                height: "120%",
                background: "radial-gradient(circle, rgba(199, 168, 120, 0.3) 0%, transparent 60%)",
                filter: "blur(30px)",
              }} />
              <img
                src="/menu images/A5 Wagyu Bowl.png"
                alt="A5 Wagyu Beef Noodle Soup"
                style={{
                  width: "100%",
                  height: "auto",
                  position: "relative",
                  filter: "drop-shadow(0 20px 50px rgba(0, 0, 0, 0.5))",
                }}
              />
            </div>
          </div>

          {/* Right: Content */}
          <div style={{ color: "#F5F0E8" }}>
            <p style={{
              fontSize: "0.85rem",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
            }}>
              {t("signature.label")}
            </p>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: "300",
                marginBottom: "24px",
                lineHeight: "1.2",
                letterSpacing: "1px",
                color: "#E8E4DC",
              }}
            >
              {t("signature.title")}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "#A9A69A",
                lineHeight: "1.9",
                marginBottom: "32px",
                fontWeight: "300",
              }}
            >
              {t("signature.description")}
            </p>
            <div style={{
              display: "flex",
              gap: "40px",
              flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: "300", color: "#C7A878" }}>48+</div>
                <div style={{ fontSize: "0.85rem", color: "#7C7A67", letterSpacing: "1px" }}>{t("signature.stats.hours")}</div>
              </div>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: "300", color: "#C7A878" }}>A5</div>
                <div style={{ fontSize: "0.85rem", color: "#7C7A67", letterSpacing: "1px" }}>{t("signature.stats.grade")}</div>
              </div>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: "300", color: "#C7A878" }}>30</div>
                <div style={{ fontSize: "0.85rem", color: "#7C7A67", letterSpacing: "1px" }}>{t("signature.stats.years")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Cards */}
      <section
        style={{
          padding: "120px 24px",
          background: "linear-gradient(180deg, #FAF8F5 0%, #FFFFFF 100%)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <p style={{
              fontSize: "0.85rem",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
            }}>
              {t("difference.label")}
            </p>
            <h2 style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: "300",
              color: "#2D2A26",
              letterSpacing: "1px",
            }}>
              {t("difference.title")}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "32px",
            }}
          >
            {/* Feature Card 1 */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "24px",
                padding: "48px 36px",
                boxShadow: "0 4px 30px rgba(124, 122, 103, 0.08)",
                transition: "all 0.4s ease",
                border: "1px solid rgba(199, 168, 120, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 20px 50px rgba(124, 122, 103, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 30px rgba(124, 122, 103, 0.08)";
              }}
            >
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #FEF3E2 0%, #FDE8CC 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "28px",
                  fontSize: "2rem",
                }}
              >
                🍜
              </div>
              <h3
                style={{
                  fontSize: "1.4rem",
                  fontWeight: "500",
                  marginBottom: "16px",
                  color: "#2D2A26",
                }}
              >
                {t("features.recipe.title")}
              </h3>
              <p
                style={{
                  fontSize: "1rem",
                  color: "#7C7A67",
                  lineHeight: "1.8",
                  fontWeight: "300",
                }}
              >
                {t("features.recipe.description")}
              </p>
            </div>

            {/* Feature Card 2 */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "24px",
                padding: "48px 36px",
                boxShadow: "0 4px 30px rgba(124, 122, 103, 0.08)",
                transition: "all 0.4s ease",
                border: "1px solid rgba(199, 168, 120, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 20px 50px rgba(124, 122, 103, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 30px rgba(124, 122, 103, 0.08)";
              }}
            >
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "28px",
                  fontSize: "2rem",
                }}
              >
                🥩
              </div>
              <h3
                style={{
                  fontSize: "1.4rem",
                  fontWeight: "500",
                  marginBottom: "16px",
                  color: "#2D2A26",
                }}
              >
                {t("features.beef.title")}
              </h3>
              <p
                style={{
                  fontSize: "1rem",
                  color: "#7C7A67",
                  lineHeight: "1.8",
                  fontWeight: "300",
                }}
              >
                {t("features.beef.description")}
              </p>
            </div>

            {/* Feature Card 3 */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "24px",
                padding: "48px 36px",
                boxShadow: "0 4px 30px rgba(124, 122, 103, 0.08)",
                transition: "all 0.4s ease",
                border: "1px solid rgba(199, 168, 120, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 20px 50px rgba(124, 122, 103, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 30px rgba(124, 122, 103, 0.08)";
              }}
            >
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "28px",
                  fontSize: "2rem",
                }}
              >
                📱
              </div>
              <h3
                style={{
                  fontSize: "1.4rem",
                  fontWeight: "500",
                  marginBottom: "16px",
                  color: "#2D2A26",
                }}
              >
                {t("features.tech.title")}
              </h3>
              <p
                style={{
                  fontSize: "1rem",
                  color: "#7C7A67",
                  lineHeight: "1.8",
                  fontWeight: "300",
                }}
              >
                {t("features.tech.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Private Pods Section */}
      <section
        style={{
          padding: "100px 24px",
          background: "#2D2A26",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "60px",
            alignItems: "center",
          }}
        >
          {/* Left: Pod Image */}
          <div
            style={{
              position: "relative",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
            }}
          >
            <img
              src="/pod.png"
              alt="Private dining pod at Oh!"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
            {/* Subtle warm overlay */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(135deg, rgba(199, 168, 120, 0.1) 0%, transparent 50%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right: Content */}
          <div>
            <p style={{
              fontSize: "0.85rem",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
            }}>
              {t("experience.label")}
            </p>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 2.8rem)",
                fontWeight: "300",
                marginBottom: "24px",
                color: "#F5F0E8",
                letterSpacing: "1px",
                lineHeight: "1.2",
              }}
            >
              {t("pods.title")}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "#A9A69A",
                lineHeight: "1.9",
                fontWeight: "300",
                marginBottom: "40px",
              }}
            >
              {t("pods.description")}
            </p>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{
                  fontSize: "1.5rem",
                  width: "48px",
                  height: "48px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>🎧</div>
                <div>
                  <h4 style={{
                    color: "#F5F0E8",
                    fontWeight: "500",
                    marginBottom: "4px",
                    fontSize: "1.1rem",
                  }}>
                    {t("pods.features.space.title")}
                  </h4>
                  <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.6" }}>
                    {t("pods.features.space.description")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{
                  fontSize: "1.5rem",
                  width: "48px",
                  height: "48px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>🔕</div>
                <div>
                  <h4 style={{
                    color: "#F5F0E8",
                    fontWeight: "500",
                    marginBottom: "4px",
                    fontSize: "1.1rem",
                  }}>
                    {t("pods.features.focus.title")}
                  </h4>
                  <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.6" }}>
                    {t("pods.features.focus.description")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{
                  fontSize: "1.5rem",
                  width: "48px",
                  height: "48px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>⚡</div>
                <div>
                  <h4 style={{
                    color: "#F5F0E8",
                    fontWeight: "500",
                    marginBottom: "4px",
                    fontSize: "1.1rem",
                  }}>
                    {t("pods.features.fast.title")}
                  </h4>
                  <p style={{ color: "#7C7A67", fontSize: "0.9rem", lineHeight: "1.6" }}>
                    {t("pods.features.fast.description")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Preview Section */}
      <section
        style={{
          padding: "120px 24px",
          background: "linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <p style={{
              fontSize: "0.85rem",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
            }}>
              {t("customize.label")}
            </p>
            <h2 style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: "300",
              color: "#2D2A26",
              letterSpacing: "1px",
              marginBottom: "16px",
            }}>
              {t("customize.title")}
            </h2>
            <p style={{
              fontSize: "1.1rem",
              color: "#7C7A67",
              maxWidth: "500px",
              margin: "0 auto",
              lineHeight: "1.7",
            }}>
              {t("customize.description")}
            </p>
          </div>

          {/* Ingredient showcase */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
            marginBottom: "48px",
          }}>
            {[
              { img: "/menu images/Ramen Noodles.png", nameKey: "customize.ingredients.ramen" },
              { img: "/menu images/Soft Boiled Egg.png", nameKey: "customize.ingredients.egg" },
              { img: "/menu images/Baby Bok Choy.png", nameKey: "customize.ingredients.bokChoy" },
              { img: "/menu images/Beef Marrow.png", nameKey: "customize.ingredients.marrow" },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  width: "160px",
                  textAlign: "center",
                  transition: "transform 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <div style={{
                  width: "140px",
                  height: "140px",
                  margin: "0 auto 12px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  boxShadow: "0 8px 30px rgba(124, 122, 103, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}>
                  <img
                    src={item.img}
                    alt={t(item.nameKey)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
                <p style={{
                  fontSize: "0.9rem",
                  color: "#5A5549",
                  fontWeight: "400",
                }}>
                  {t(item.nameKey)}
                </p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <Link
              href={`/${locale}/menu`}
              style={{
                display: "inline-block",
                padding: "16px 40px",
                fontSize: "1rem",
                fontWeight: "500",
                background: "transparent",
                color: "#C7A878",
                borderRadius: "50px",
                textDecoration: "none",
                transition: "all 0.3s ease",
                border: "2px solid #C7A878",
                letterSpacing: "2px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#C7A878";
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#C7A878";
              }}
            >
              {t("viewFullMenu")}
            </Link>
          </div>
        </div>
      </section>

      {/* No Tipping Section */}
      <section
        style={{
          padding: "100px 24px",
          background: "linear-gradient(135deg, #F5F0E8 0%, #EDE4D8 100%)",
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
              width: "90px",
              height: "90px",
              background: "#FFFFFF",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 32px",
              fontSize: "2.5rem",
              boxShadow: "0 8px 30px rgba(124, 122, 103, 0.1)",
            }}
          >
            💯
          </div>
          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 2.8rem)",
              fontWeight: "300",
              marginBottom: "24px",
              color: "#2D2A26",
              letterSpacing: "1px",
            }}
          >
            {t("noTipping.title")}
          </h2>
          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
              color: "#5A5549",
              lineHeight: "2",
              fontWeight: "300",
              maxWidth: "650px",
              margin: "0 auto 48px",
            }}
          >
            {t("noTipping.description")}
          </p>

          <div
            style={{
              display: "inline-flex",
              background: "white",
              borderRadius: "100px",
              padding: "20px 48px",
              boxShadow: "0 8px 40px rgba(124, 122, 103, 0.12)",
              gap: "48px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "1.5rem",
                marginBottom: "8px",
                color: "#10B981",
              }}>✓</div>
              <p style={{ color: "#5A5549", fontSize: "0.95rem", fontWeight: "500" }}>
                {t("noTipping.benefits.wages")}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "1.5rem",
                marginBottom: "8px",
                color: "#10B981",
              }}>✓</div>
              <p style={{ color: "#5A5549", fontSize: "0.95rem", fontWeight: "500" }}>
                {t("noTipping.benefits.math")}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "1.5rem",
                marginBottom: "8px",
                color: "#10B981",
              }}>✓</div>
              <p style={{ color: "#5A5549", fontSize: "0.95rem", fontWeight: "500" }}>
                {t("noTipping.benefits.checkout")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        style={{
          padding: "120px 24px",
          background: "#2D2A26",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative elements */}
        <div style={{
          position: "absolute",
          top: "-100px",
          left: "-100px",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(199, 168, 120, 0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-100px",
          right: "-100px",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(199, 168, 120, 0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: "300",
              marginBottom: "24px",
              color: "#F5F0E8",
              letterSpacing: "1px",
              lineHeight: "1.3",
            }}
          >
            {t("cta.title")}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#A9A69A",
              lineHeight: "1.8",
              marginBottom: "48px",
              fontWeight: "300",
            }}
          >
            {t("cta.description")}
          </p>

          <Link
            href={`/${locale}/order`}
            style={{
              padding: "20px 64px",
              fontSize: "1.1rem",
              fontWeight: "500",
              background: "linear-gradient(135deg, #C7A878 0%, #B8956A 100%)",
              color: "#ffffff",
              borderRadius: "50px",
              textDecoration: "none",
              transition: "all 0.4s ease",
              display: "inline-block",
              letterSpacing: "2px",
              boxShadow: "0 8px 30px rgba(199, 168, 120, 0.35)",
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
            {t("cta.button")}
          </Link>
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
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(10px);
          }
        }
        @keyframes scrollDown {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateY(12px);
          }
        }
        @media (max-width: 768px) {
          section > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          .scroll-indicator {
            bottom: 16px !important;
          }
          .scroll-indicator-inner {
            width: 22px !important;
            height: 36px !important;
            padding-top: 6px !important;
          }
          .scroll-indicator-dot {
            width: 3px !important;
            height: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
