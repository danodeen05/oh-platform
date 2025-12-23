"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Location = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
};

export default function LocationsPage() {
  const t = useTranslations("locations");
  const locale = useLocale();

  // Location-specific data - using translations
  const locationDetails: Record<string, {
    image: string;
    tagline: string;
    description: string;
    mallDescription: string;
    nearbyLandmarks: string[];
    parking: string;
  }> = {
    "City Creek Mall": {
      image: "/locations/CityCreekSaltLake.jpg",
      tagline: t("cityCreek.tagline"),
      description: t("cityCreek.description"),
      mallDescription: t("cityCreek.mallDescription"),
      nearbyLandmarks: t.raw("cityCreek.nearbyLandmarks") as string[],
      parking: t("cityCreek.parking"),
    },
    "University Place": {
      image: "/locations/UniversityPlaceOrem.jpg",
      tagline: t("universityPlace.tagline"),
      description: t("universityPlace.description"),
      mallDescription: t("universityPlace.mallDescription"),
      nearbyLandmarks: t.raw("universityPlace.nearbyLandmarks") as string[],
      parking: t("universityPlace.parking"),
    },
  };
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch(`${BASE}/locations`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (response.ok) {
          const data = await response.json();
          const ohLocations = data.filter((loc: Location) =>
            loc.name === "City Creek Mall" || loc.name === "University Place"
          );
          setLocations(ohLocations);
          if (ohLocations.length > 0) {
            setActiveLocation(ohLocations[0].name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLocations();
  }, []);

  const activeLocationData = locations.find(l => l.name === activeLocation);
  const activeDetails = activeLocation ? locationDetails[activeLocation] : null;

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Hero with Featured Location Image */}
      <section style={{ position: "relative", height: "70vh", minHeight: "500px", overflow: "hidden" }}>
        {activeDetails && (
          <>
            <Image
              src={activeDetails.image}
              alt={activeLocation || "Location"}
              fill
              style={{ objectFit: "cover" }}
              priority
            />
            {/* Gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)",
              }}
            />
          </>
        )}

        {/* Hero Content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "24px",
            color: "white",
          }}
        >
          <p
            style={{
              fontSize: "0.9rem",
              textTransform: "uppercase",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
              textShadow: "0 1px 8px rgba(0,0,0,0.3)",
            }}
          >
            {t("hero.findUs")}
          </p>
          <h1
            style={{
              fontSize: "clamp(2.5rem, 8vw, 5rem)",
              fontWeight: "300",
              marginBottom: "24px",
              letterSpacing: "2px",
              color: "white",
              textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            }}
          >
            {t("hero.title")}
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
              maxWidth: "600px",
              lineHeight: "1.8",
              fontWeight: "300",
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 1px 10px rgba(0,0,0,0.4)",
            }}
          >
            {t("hero.description")}
          </p>

          {/* Location Toggle */}
          {!loading && locations.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "40px",
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                padding: "6px",
                borderRadius: "40px",
              }}
            >
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setActiveLocation(loc.name)}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "30px",
                    border: "none",
                    background: activeLocation === loc.name ? "white" : "transparent",
                    color: activeLocation === loc.name ? "#222" : "white",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    fontSize: "0.95rem",
                  }}
                >
                  {loc.city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "white",
            opacity: 0.7,
            animation: "bounce 2s infinite",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Location Details */}
      {activeLocationData && activeDetails && (
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "60px",
              alignItems: "start",
            }}
          >
            {/* Left Column - Info */}
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
                {activeDetails.tagline}
              </p>
              <h2
                style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  fontWeight: "400",
                  color: "#222",
                  marginBottom: "24px",
                  lineHeight: "1.2",
                }}
              >
                {activeLocationData.name}
              </h2>
              <p
                style={{
                  fontSize: "1.1rem",
                  color: "#555",
                  lineHeight: "1.8",
                  marginBottom: "32px",
                }}
              >
                {activeDetails.description}
              </p>

              {/* Address Card */}
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "28px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgba(124, 122, 103, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.8rem", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                      {t("details.address")}
                    </h4>
                    <p style={{ color: "#222", fontSize: "1rem", lineHeight: "1.5" }}>
                      {activeLocationData.address}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgba(124, 122, 103, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.8rem", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                      {t("details.hours")}
                    </h4>
                    <p style={{ color: "#222", fontSize: "1rem", lineHeight: "1.6" }}>
                      {t("details.hoursMonThurs")}<br />
                      {t("details.hoursFriSat")}<br />
                      {t("details.hoursSun")}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgba(124, 122, 103, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C7A67" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.8rem", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                      {t("details.parking")}
                    </h4>
                    <p style={{ color: "#222", fontSize: "1rem" }}>
                      {activeDetails.parking}
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link
                  href={`/${locale}/order/location/${activeLocationData.id}`}
                  style={{
                    padding: "16px 36px",
                    background: "#7C7A67",
                    color: "white",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: "500",
                    fontSize: "1rem",
                    transition: "all 0.3s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {t("buttons.orderAhead")}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(activeLocationData.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "16px 36px",
                    background: "transparent",
                    color: "#7C7A67",
                    border: "2px solid #7C7A67",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: "500",
                    fontSize: "1rem",
                    transition: "all 0.3s ease",
                  }}
                >
                  {t("buttons.getDirections")}
                </a>
              </div>
            </div>

            {/* Right Column - About the Mall */}
            <div>
              <div
                style={{
                  background: "#222",
                  borderRadius: "20px",
                  padding: "40px",
                  color: "white",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "400",
                    marginBottom: "20px",
                    color: "#C7A878",
                  }}
                >
                  {t("about.title")} {activeLocationData.name}
                </h3>
                <p style={{ fontSize: "1rem", lineHeight: "1.8", opacity: 0.85, marginBottom: "28px" }}>
                  {activeDetails.mallDescription}
                </p>

                <h4
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    color: "#C7A878",
                    marginBottom: "16px",
                  }}
                >
                  {t("about.nearby")}
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {activeDetails.nearbyLandmarks.map((landmark, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        color: "rgba(255,255,255,0.8)",
                      }}
                    >
                      {landmark}
                    </span>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  { icon: "🥢", label: t("features.privatePods") },
                  { icon: "📱", label: t("features.orderAhead") },
                  { icon: "💳", label: t("features.noTipping") },
                  { icon: "♿", label: t("features.accessible") },
                ].map((feature, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "20px",
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "8px" }}>{feature.icon}</span>
                    <span style={{ fontSize: "0.85rem", color: "#555", fontWeight: "500" }}>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Loading State */}
      {loading && (
        <section style={{ padding: "120px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🍜</div>
          <p style={{ color: "#666" }}>{t("loading")}</p>
        </section>
      )}

      {/* The Oh! Way Section */}
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
            {t("ohWay.label")}
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
            {t("ohWay.title")}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "48px",
              textAlign: "left",
            }}
          >
            <div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.4rem",
                }}
              >
                🎯
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "rgba(255,255,255,0.95)" }}>
                {t("ohWay.kiosk.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>
                {t("ohWay.kiosk.description")}
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.4rem",
                }}
              >
                🏠
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "rgba(255,255,255,0.95)" }}>
                {t("ohWay.pod.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>
                {t("ohWay.pod.description")}
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.4rem",
                }}
              >
                ❤️
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "rgba(255,255,255,0.95)" }}>
                {t("ohWay.noTips.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>
                {t("ohWay.noTips.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section style={{ background: "#faf9f7", padding: "80px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222",
              marginBottom: "16px",
            }}
          >
            {t("comingSoon.title")}
          </h2>
          <p style={{ color: "#666", marginBottom: "40px", fontSize: "1.1rem" }}>
            {t("comingSoon.description")}
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: "24px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {(t.raw("comingSoon.cities") as string[]).map((city) => (
              <span
                key={city}
                style={{
                  padding: "12px 24px",
                  border: "1px dashed #ccc",
                  borderRadius: "30px",
                  color: "#888",
                  fontSize: "0.95rem",
                }}
              >
                {city} • {t("comingSoon.label")}
              </span>
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
          <Link
            href={`/${locale}/order`}
            style={{
              display: "inline-block",
              padding: "18px 48px",
              background: "white",
              color: "#7C7A67",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1.1rem",
              transition: "all 0.3s ease",
            }}
          >
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
          40% { transform: translateX(-50%) translateY(-10px); }
          60% { transform: translateX(-50%) translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
