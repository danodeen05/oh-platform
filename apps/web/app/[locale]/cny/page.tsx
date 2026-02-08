"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CNYWelcome() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleRSVP = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/en/cny/details");
    }, 400);
  };

  return (
    <div
      className={`cny-page cny-page-1`}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? "translateY(-30px)" : "translateY(0)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* Content positioned in the red space above 2026 */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <h1
          className="cny-heading"
          style={{
            fontSize: "clamp(2rem, 10vw, 3.5rem)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          YOU'RE
          <br />
          INVITED
        </h1>

        <button
          className="cny-button"
          onClick={handleRSVP}
          style={{
            marginTop: "16px",
          }}
        >
          RSVP Now
        </button>
      </div>
    </div>
  );
}
