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
      }}
    >
      {/* Event details content */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          padding: "0 24px",
        }}
      >
        <div className="cny-details">
          <h1
            className="cny-details-title cny-heading"
            style={{
              fontSize: "clamp(1.8rem, 8vw, 2.5rem)",
              marginBottom: "20px",
            }}
          >
            Year of the Horse
          </h1>

          <div
            className="cny-details-info cny-subheading"
            style={{
              animationDelay: "0.2s",
            }}
          >
            <p style={{ margin: "8px 0", fontWeight: 600 }}>
              Fri, Feb 20 · 6–8 PM
            </p>
            <p style={{ margin: "8px 0" }}>
              Embold Clubroom & Kitchen
              <br />
              Lehi, UT
            </p>
          </div>

          <div
            className="cny-details-activities cny-subheading"
            style={{
              marginTop: "28px",
              animationDelay: "0.4s",
            }}
          >
            <p style={{ margin: "6px 0" }}>Beef Noodle Soup</p>
            <p style={{ margin: "6px 0" }}>Mahjong</p>
            <p style={{ margin: "6px 0" }}>Learn Some Chinese</p>
            <p style={{ margin: "6px 0" }}>Year of the Horse 101</p>
            <p style={{ margin: "6px 0", fontSize: "0.9rem", opacity: 0.85 }}>
              Golf Sim
              <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                {" "}
                (for the culturally uninterested)
              </span>
            </p>
          </div>
        </div>

        <button
          className="cny-button cny-button-red"
          onClick={handleContinue}
          style={{
            marginTop: "24px",
            animationDelay: "0.5s",
          }}
        >
          Continue to RSVP
        </button>
      </div>
    </div>
  );
}
