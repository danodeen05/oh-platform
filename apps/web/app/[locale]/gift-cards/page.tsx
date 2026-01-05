"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

const giftCardAmounts = [25, 50, 75, 100, 150, 200];

export default function GiftCardsPage() {
  const t = useTranslations("giftCards");
  const tCommon = useTranslations("common");

  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedDesign, setSelectedDesign] = useState("classic");

  // Gift card design options
  const cardDesigns = [
    { id: "classic", name: t("designs.classic"), gradient: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)" },
    { id: "dark", name: t("designs.dark"), gradient: "linear-gradient(135deg, #222222 0%, #444444 100%)" },
    { id: "gold", name: t("designs.gold"), gradient: "linear-gradient(135deg, #C7A878 0%, #8B7355 100%)" },
  ];

  const currentDesign = cardDesigns.find(d => d.id === selectedDesign) || cardDesigns[0];
  const displayAmount = selectedAmount || Number(customAmount) || 0;

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Hero Section with Gift Card Preview */}
      <section
        style={{
          position: "relative",
          minHeight: "90vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #222222 0%, #333333 50%, #faf9f7 100%)",
          padding: "120px 24px 80px",
          overflow: "hidden",
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "5%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(199, 168, 120, 0.1) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            right: "10%",
            width: "200px",
            height: "200px",
            background: "radial-gradient(circle, rgba(124, 122, 103, 0.1) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: "1200px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Header text */}
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <p
              style={{
                fontSize: "0.9rem",
                textTransform: "uppercase",
                letterSpacing: "4px",
                color: "#C7A878",
                marginBottom: "16px",
                fontWeight: "500",
              }}
            >
              {t("tagline")}
            </p>
            <h1
              style={{
                fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                fontWeight: "300",
                color: "white",
                marginBottom: "24px",
                letterSpacing: "2px",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              }}
            >
              {t("title")}
            </h1>
            <p
              style={{
                fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
                maxWidth: "600px",
                margin: "0 auto",
                lineHeight: "1.8",
                fontWeight: "300",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {t("description")}
            </p>
          </div>

          {/* Large Gift Card Preview */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "500px",
              aspectRatio: "1.6 / 1",
              borderRadius: "24px",
              background: currentDesign.gradient,
              boxShadow: "0 30px 60px rgba(0,0,0,0.4), 0 10px 20px rgba(0,0,0,0.2)",
              overflow: "hidden",
              transform: "perspective(1000px) rotateX(5deg)",
              transition: "all 0.5s ease",
            }}
          >
            {/* Bamboo/wood texture overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.08,
                backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(255,255,255,0.3) 2px,
                    rgba(255,255,255,0.3) 4px
                  ),
                  repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 20px,
                    rgba(0,0,0,0.1) 20px,
                    rgba(0,0,0,0.1) 22px
                  )
                `,
                pointerEvents: "none",
              }}
            />

            {/* Subtle grain texture */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                pointerEvents: "none",
              }}
            />

            {/* Card shine effect */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Card content */}
            <div style={{ position: "relative", height: "100%", padding: "32px", display: "flex", flexDirection: "column" }}>
              {/* Top section with larger logo */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.6)",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                  }}
                >
                  {t("digitalCard")}
                </div>
                <div style={{ width: "clamp(100px, 25vw, 140px)", height: "clamp(100px, 25vw, 140px)", position: "relative", marginTop: "-20px", marginRight: "-10px" }}>
                  <Image
                    src="/Oh_Logo_Large.png"
                    alt="Oh! Logo"
                    fill
                    sizes="(max-width: 768px) 100px, 140px"
                    style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }}
                  />
                </div>
              </div>

              {/* Center - Amount */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", marginTop: "-30px" }}>
                <div
                  style={{
                    fontSize: "clamp(3rem, 10vw, 5rem)",
                    fontWeight: "300",
                    color: "white",
                    lineHeight: 1,
                    textShadow: "0 2px 10px rgba(0,0,0,0.2)",
                  }}
                >
                  ${displayAmount}
                </div>
              </div>

              {/* Bottom section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "300", color: "white", letterSpacing: "1px" }}>
                    Oh! Beef Noodle Soup
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: "4px" }}>
                    ohbeefnoodlesoup.com
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Design selector */}
          <div style={{ display: "flex", gap: "12px", marginTop: "32px", position: "relative", zIndex: 10 }}>
            {cardDesigns.map((design) => (
              <button
                key={design.id}
                onClick={() => setSelectedDesign(design.id)}
                style={{
                  width: "48px",
                  height: "32px",
                  borderRadius: "8px",
                  background: design.gradient,
                  border: selectedDesign === design.id ? "3px solid white" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: selectedDesign === design.id ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                  position: "relative",
                  zIndex: 10,
                }}
                title={design.name}
              />
            ))}
          </div>

          {/* Scroll indicator */}
          <div
            style={{
              marginTop: "60px",
              color: "rgba(255,255,255,0.5)",
              animation: "bounce 2s infinite",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* Amount Selection Section */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#C7A878",
              textTransform: "uppercase",
              letterSpacing: "3px",
              marginBottom: "12px",
              fontWeight: "600",
            }}
          >
            {t("chooseAmount.tagline")}
          </p>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "400",
              color: "#222",
              lineHeight: "1.2",
            }}
          >
            {t("chooseAmount.title")}
          </h2>
        </div>

        {/* Amount buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {giftCardAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount("");
              }}
              style={{
                padding: "24px 16px",
                background: selectedAmount === amount ? "#7C7A67" : "white",
                color: selectedAmount === amount ? "white" : "#222",
                border: "none",
                borderRadius: "16px",
                cursor: "pointer",
                fontSize: "1.5rem",
                fontWeight: "500",
                transition: "all 0.3s ease",
                boxShadow: selectedAmount === amount
                  ? "0 8px 24px rgba(124, 122, 103, 0.4)"
                  : "0 4px 12px rgba(0,0,0,0.06)",
                transform: selectedAmount === amount ? "scale(1.02)" : "scale(1)",
              }}
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <label style={{ fontSize: "0.9rem", color: "#666", display: "block", marginBottom: "12px" }}>
            {t("chooseAmount.customLabel")}
          </label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#7C7A67",
                fontSize: "1.5rem",
                fontWeight: "500",
              }}
            >
              $
            </span>
            <input
              type="number"
              min="10"
              max="500"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
              placeholder={t("chooseAmount.customPlaceholder")}
              style={{
                width: "100%",
                padding: "20px 20px 20px 48px",
                border: "2px solid #e5e7eb",
                borderRadius: "12px",
                fontSize: "1.3rem",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => e.target.style.borderColor = "#7C7A67"}
              onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
            />
          </div>
        </div>

        {/* Continue button - links to purchase flow */}
        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <Link
            href={`/gift-cards/purchase?amount=${displayAmount}&design=${selectedDesign}`}
            style={{
              padding: "20px 60px",
              background: displayAmount >= 10 ? "#7C7A67" : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "1.1rem",
              fontWeight: "600",
              cursor: displayAmount >= 10 ? "pointer" : "not-allowed",
              transition: "all 0.3s ease",
              boxShadow: displayAmount >= 10 ? "0 8px 24px rgba(124, 122, 103, 0.3)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              pointerEvents: displayAmount >= 10 ? "auto" : "none",
            }}
          >
            {t("continue")}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          {displayAmount > 0 && displayAmount < 10 && (
            <p style={{ color: "#ef4444", fontSize: "0.9rem", marginTop: "16px" }}>
              Minimum amount is $10
            </p>
          )}
        </div>
      </section>

      {/* Features Section - The Oh! Way style */}
      <section style={{ background: "#222", color: "white", padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "20px",
            }}
          >
            {t("why.title")}
          </p>
          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: "300",
              marginBottom: "60px",
              lineHeight: "1.3",
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {t("why.subtitle")}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "48px",
              textAlign: "center",
            }}
          >
            {[
              { icon: "⚡", title: t("why.instantDelivery.title"), desc: t("why.instantDelivery.description") },
              { icon: "🎨", title: t("why.beautifulDesign.title"), desc: t("why.beautifulDesign.description") },
              { icon: "♾️", title: t("why.neverExpires.title"), desc: t("why.neverExpires.description") },
              { icon: "💝", title: t("why.addMessage.title"), desc: t("why.addMessage.description") },
            ].map((feature, idx) => (
              <div key={idx}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    background: "rgba(199, 168, 120, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    fontSize: "1.8rem",
                  }}
                >
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "rgba(255,255,255,0.95)" }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Section */}
      <section style={{ background: "#faf9f7", padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "60px", alignItems: "center" }}>
          <div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#C7A878",
                textTransform: "uppercase",
                letterSpacing: "3px",
                marginBottom: "12px",
                fontWeight: "600",
              }}
            >
              {t("corporate.tagline")}
            </p>
            <h2
              style={{
                fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                fontWeight: "400",
                color: "#222",
                marginBottom: "24px",
                lineHeight: "1.2",
              }}
            >
              {t("corporate.title")}
            </h2>
            <p style={{ fontSize: "1.1rem", color: "#555", lineHeight: "1.8", marginBottom: "32px" }}>
              {t("corporate.description")}
            </p>
            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "16px 32px",
                background: "#222",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "500",
                transition: "all 0.3s ease",
              }}
            >
              {t("corporate.contactSales")}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "40px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "grid", gap: "24px" }}>
              {[
                { label: t("corporate.bulkDiscounts"), value: t("corporate.tenPlus") },
                { label: t("corporate.customBranding"), value: t("corporate.addLogo") },
                { label: t("corporate.dedicatedSupport"), value: t("corporate.priorityService") },
                { label: t("corporate.flexibleDelivery"), value: t("corporate.scheduleSends") },
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: idx < 3 ? "1px solid #eee" : "none" }}>
                  <span style={{ color: "#666", fontSize: "1rem" }}>{item.label}</span>
                  <span style={{ color: "#222", fontWeight: "600", fontSize: "1rem" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{ background: "white", padding: "100px 24px" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#C7A878",
                textTransform: "uppercase",
                letterSpacing: "3px",
                marginBottom: "12px",
                fontWeight: "600",
              }}
            >
              {t("faq.tagline")}
            </p>
            <h2
              style={{
                fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                fontWeight: "400",
                color: "#222",
                lineHeight: "1.2",
              }}
            >
              {t("faq.title")}
            </h2>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {[
              { q: t("faq.questions.delivery.q"), a: t("faq.questions.delivery.a") },
              { q: t("faq.questions.multiple.q"), a: t("faq.questions.multiple.a") },
              { q: t("faq.questions.expire.q"), a: t("faq.questions.expire.a") },
              { q: t("faq.questions.balance.q"), a: t("faq.questions.balance.a") },
            ].map((faq, idx) => (
              <div
                key={idx}
                style={{
                  background: "#faf9f7",
                  padding: "28px",
                  borderRadius: "16px",
                }}
              >
                <h4 style={{ fontSize: "1.05rem", fontWeight: "600", color: "#222", marginBottom: "12px" }}>
                  {faq.q}
                </h4>
                <p style={{ color: "#666", lineHeight: "1.7", fontSize: "0.95rem" }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: "400",
              color: "white",
              marginBottom: "24px",
            }}
          >
            {t("cta.title")}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "32px", fontSize: "1.1rem" }}>
            {t("cta.description")}
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              display: "inline-block",
              padding: "18px 48px",
              background: "white",
              color: "#7C7A67",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "1.1rem",
              transition: "all 0.3s ease",
            }}
          >
            {t("cta.button")}
          </button>
        </div>
      </section>

      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
