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
        <div className="cny-details" style={{ maxWidth: "540px" }}>
          <h1
            className="cny-details-title"
            style={{
              fontSize: "clamp(1.8rem, 9vw, 2.8rem)",
              marginBottom: "20px",
              whiteSpace: "nowrap",
            }}
          >
            Year of the Horse
          </h1>

          <p
            style={{
              color: "#444",
              fontSize: "clamp(1.05rem, 4vw, 1.25rem)",
              lineHeight: 1.75,
              marginBottom: "20px",
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
              fontSize: "clamp(1rem, 3.8vw, 1.15rem)",
              lineHeight: 1.7,
              marginBottom: "28px",
              fontStyle: "italic",
            }}
          >
            And if culture isn't your thing, there's a golf simulator. No
            judgment. Your secret's safe with us.
          </p>

          <div
            className="cny-details-info"
            style={{
              fontSize: "clamp(1.4rem, 5.5vw, 1.8rem)",
              fontWeight: 700,
              marginTop: "8px",
            }}
          >
            <p style={{ margin: "8px 0" }}>Fri, Feb 20 · 6–8 PM</p>
            <p style={{ margin: "8px 0" }}>
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
            marginTop: "32px",
            animationDelay: "0.5s",
            fontSize: "1.4rem",
            padding: "24px 60px",
            letterSpacing: "3px",
          }}
        >
          Continue to RSVP
        </button>
      </div>
    </div>
  );
}
