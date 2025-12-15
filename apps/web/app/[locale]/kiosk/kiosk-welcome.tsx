"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Location = {
  id: string;
  name: string;
  address: string;
  tenantId: string;
};

export default function KioskWelcome({ location }: { location: Location }) {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "party-size" | "payment-type">("welcome");
  const [partySize, setPartySize] = useState(1);

  function handleStart() {
    setStep("party-size");
  }

  function handlePartySelect(size: number) {
    setPartySize(size);
    if (size === 1) {
      // Single person goes straight to ordering
      router.push(`/kiosk/order?locationId=${location.id}&partySize=1&paymentType=single`);
    } else {
      // Multiple people need to choose payment type
      setStep("payment-type");
    }
  }

  function handlePaymentType(type: "single" | "separate") {
    router.push(`/kiosk/order?locationId=${location.id}&partySize=${partySize}&paymentType=${type}`);
  }

  // Welcome screen - tap to start
  if (step === "welcome") {
    return (
      <main
        onClick={handleStart}
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          cursor: "pointer",
          padding: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "6rem",
            marginBottom: 32,
            animation: "pulse 2s infinite",
          }}
        >
          Oh!
        </div>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 700,
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          Welcome to {location.name}
        </h1>
        <p style={{ fontSize: "1.5rem", color: "#999", marginBottom: 64 }}>
          Taiwanese Hot Pot Experience
        </p>

        <div
          style={{
            padding: "24px 64px",
            background: "#7C7A67",
            borderRadius: 16,
            fontSize: "1.5rem",
            fontWeight: 600,
            animation: "bounce 1.5s infinite",
          }}
        >
          Tap Anywhere to Start
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </main>
    );
  }

  // Party size selector
  if (step === "party-size") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          padding: 48,
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          How many dining today?
        </h1>
        <p style={{ fontSize: "1.25rem", color: "#999", marginBottom: 48 }}>
          Select your party size
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
            maxWidth: 800,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
            <button
              key={size}
              onClick={() => handlePartySelect(size)}
              style={{
                width: 140,
                height: 140,
                borderRadius: 20,
                border: "3px solid #7C7A67",
                background: "rgba(124, 122, 103, 0.1)",
                color: "white",
                fontSize: "3rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#7C7A67";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(124, 122, 103, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {size}
              <span style={{ fontSize: "0.9rem", fontWeight: 400, marginTop: 4, color: "#ccc" }}>
                {size === 1 ? "guest" : "guests"}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep("welcome")}
          style={{
            marginTop: 48,
            padding: "16px 32px",
            background: "transparent",
            border: "2px solid #666",
            borderRadius: 12,
            color: "#999",
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </main>
    );
  }

  // Payment type selector (for parties of 2+)
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        color: "white",
        padding: 48,
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        How would you like to pay?
      </h1>
      <p style={{ fontSize: "1.25rem", color: "#999", marginBottom: 48 }}>
        Party of {partySize}
      </p>

      <div style={{ display: "flex", gap: 32, maxWidth: 800 }}>
        {/* One Check */}
        <button
          onClick={() => handlePaymentType("single")}
          style={{
            flex: 1,
            padding: 48,
            borderRadius: 24,
            border: "3px solid #7C7A67",
            background: "rgba(124, 122, 103, 0.1)",
            color: "white",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#7C7A67";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124, 122, 103, 0.1)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>1</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
            One Check
          </div>
          <div style={{ fontSize: "1rem", color: "#ccc" }}>
            Everyone orders, one person pays at the end
          </div>
        </button>

        {/* Separate Checks */}
        <button
          onClick={() => handlePaymentType("separate")}
          style={{
            flex: 1,
            padding: 48,
            borderRadius: 24,
            border: "3px solid #7C7A67",
            background: "rgba(124, 122, 103, 0.1)",
            color: "white",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#7C7A67";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124, 122, 103, 0.1)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>{partySize}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
            Separate Checks
          </div>
          <div style={{ fontSize: "1rem", color: "#ccc" }}>
            Each person orders and pays individually
          </div>
        </button>
      </div>

      <button
        onClick={() => setStep("party-size")}
        style={{
          marginTop: 48,
          padding: "16px 32px",
          background: "transparent",
          border: "2px solid #666",
          borderRadius: 12,
          color: "#999",
          fontSize: "1.1rem",
          cursor: "pointer",
        }}
      >
        Back
      </button>
    </main>
  );
}
