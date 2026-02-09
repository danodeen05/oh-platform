"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { FortuneModal } from "@/components/cny/FortuneModal";

function ThanksContent() {
  const searchParams = useSearchParams();
  const [showFortune, setShowFortune] = useState(false);

  // Read query params from RSVP form
  const name = searchParams.get("name") || "";
  const phone = searchParams.get("phone") || "";
  const birthdate = searchParams.get("birthdate") || "";

  // Get first name for personalized greeting
  const firstName = name ? name.split(" ")[0] : "";

  // Auto-show fortune modal when page loads if we have a name
  useEffect(() => {
    if (name) {
      // Small delay for page transition to complete
      const timer = setTimeout(() => setShowFortune(true), 600);
      return () => clearTimeout(timer);
    }
  }, [name]);

  return (
    <div className="cny-page cny-page-2">
      {/* Thank you content */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "14%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "0 24px",
        }}
      >
        <h1
          className="cny-heading cny-heading-red cny-thankyou"
          style={{
            fontSize: firstName
              ? "clamp(1.3rem, 6vw, 2rem)"
              : "clamp(1.5rem, 7vw, 2.4rem)",
            lineHeight: 1.1,
            margin: 0,
            background: "rgba(215, 182, 110, 0.5)",
            padding: "10px 20px",
            borderRadius: "12px",
            whiteSpace: "nowrap",
          }}
        >
          {firstName ? `THANK YOU, ${firstName.toUpperCase()}!` : "THANK YOU!!"}
        </h1>

        <div
          className="cny-subheading"
          style={{
            fontSize: "clamp(1.1rem, 4.5vw, 1.5rem)",
            fontWeight: 700,
            color: "#D7B66E",
            maxWidth: "300px",
            animationDelay: "0.3s",
            background: "rgba(145, 12, 30, 0.85)",
            padding: "12px 20px",
            borderRadius: "12px",
            textAlign: "center",
            lineHeight: 1.3,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          We'll see you on
          <br />
          <strong>Friday, February 20th!</strong>
        </div>

        <img
          src="/cny/horse.svg"
          alt="Year of the Horse"
          className="cny-horse-red"
          style={{
            marginTop: "8px",
            width: "clamp(275px, 81vw, 500px)",
            maxWidth: "85vw",
            height: "auto",
            animation:
              "bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.6s forwards",
            opacity: 0,
          }}
        />

        {/* Button to re-open fortune if modal was closed */}
        {name && !showFortune && (
          <button
            onClick={() => setShowFortune(true)}
            className="cny-button"
            style={{
              marginTop: "8px",
              fontSize: "0.85rem",
              padding: "12px 24px",
              animationDelay: "0.8s",
            }}
          >
            View Your Fortune
          </button>
        )}

        <a
          href="/en/cny"
          className="cny-button cny-button-red"
          style={{
            marginTop: "8px",
            textDecoration: "none",
            fontSize: "0.9rem",
            padding: "12px 24px",
          }}
        >
          RSVP for Someone Else
        </a>
      </div>

      {/* Fortune Modal */}
      <FortuneModal
        open={showFortune}
        onClose={() => setShowFortune(false)}
        name={name}
        phone={phone}
        birthdate={birthdate}
      />
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="cny-page cny-page-2">
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <img
          src="/cny/horse.svg"
          alt="Loading..."
          className="cny-horse-red"
          style={{
            width: "150px",
            height: "auto",
            animation: "pulse 1s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function CNYThanks() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ThanksContent />
    </Suspense>
  );
}
