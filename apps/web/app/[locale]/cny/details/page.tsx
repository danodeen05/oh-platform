"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CNYDetails() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleContinue = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/en/cny/rsvp");
    }, 400);
  };

  return (
    <div
      className={`cny-page cny-page-2`}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? "translateY(-30px)" : "translateY(0)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Event details content */}
      <div
        className="cny-content"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px",
          width: "100%",
        }}
      >
        <div className="cny-details" style={{ maxWidth: "340px", padding: "12px 16px" }}>
          <h1
            className="cny-details-title"
            style={{
              fontSize: "clamp(1.4rem, 6vw, 2rem)",
              marginBottom: "12px",
              whiteSpace: "nowrap",
            }}
          >
            Year of the Horse
          </h1>

          <p
            style={{
              color: "#444",
              fontSize: "clamp(0.85rem, 3.2vw, 1rem)",
              lineHeight: 1.6,
              marginBottom: "12px",
              fontWeight: 500,
            }}
          >
            Dano & Kristy are back with their annual Chinese New Year party.
            This year's beef noodle soup might be their best batch yet (bold
            claim, we know). Pull up a seat at the mahjong table (yes, there are
            prizes), pick up a few Chinese phrases, and find out what the Year
            of the Horse has in store for your zodiac. Come hungry, leave
            cultured.
          </p>
          <p
            style={{
              color: "#555",
              fontSize: "clamp(0.8rem, 3vw, 0.95rem)",
              lineHeight: 1.5,
              marginBottom: "16px",
              fontStyle: "italic",
            }}
          >
            And if culture isn't your thing, there's a golf simulator. No
            judgment. Your secret's safe with us.
          </p>

          <div
            className="cny-details-info"
            style={{
              fontSize: "clamp(1rem, 4vw, 1.3rem)",
              fontWeight: 700,
              marginTop: "4px",
            }}
          >
            <p style={{ margin: "4px 0" }}>Fri, Feb 20 · 6–8 PM</p>
            <p style={{ margin: "4px 0" }}>
              Embold Clubroom & Kitchen
              <br />
              Lehi, UT
            </p>
          </div>
        </div>

        <button
          className="cny-button cny-button-red"
          onClick={handleContinue}
          style={{
            marginTop: "20px",
            animationDelay: "0.5s",
            fontSize: "1rem",
            padding: "14px 36px",
            letterSpacing: "2px",
          }}
        >
          Continue to RSVP
        </button>
      </div>
    </div>
  );
}
