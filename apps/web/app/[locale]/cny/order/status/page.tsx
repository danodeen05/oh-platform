"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
import { AnimatedBackground } from "@/components/cny/AnimatedBackground";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrderData {
  id: string;
  orderNumber: string;
  kitchenOrderNumber: string;
  orderQrCode: string;
  status: string;
  guestName: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    selectedValue?: string | null;
  }>;
}

interface Fortune {
  fortune: string;
  luckyNumbers: number[];
  thisDayInHistory: {
    year: number;
    event: string;
  } | null;
  learnChinese: {
    traditional: string;
    pinyin: string;
    english: string;
    category: string;
    funFact: string;
    source: string;
  } | null;
  source: string;
  orderNumber: string;
  customerName: string | null;
}

interface OrderCommentary {
  commentary: string | null;
  status: string;
  source: string;
  customerName: string | null;
  podNumber: string | null;
}

interface ZodiacInsights {
  guestName: string;
  firstName: string;
  birthday: string;
  zodiac: string;
  zodiacEmoji: string;
  horseYearAdvice: string;
  compatibleGuests: Array<{ name: string; zodiac: string }>;
  avoidGuests: Array<{ name: string; zodiac: string }>;
  hangOutWith: string;
  avoidTonight: string;
  source: string;
}

// CNY-themed status colors (gold/red theme)
const STATUS_CONFIG: Record<
  string,
  { label: string; description: string; color: string; progress: number; icon: string }
> = {
  QUEUED: {
    label: "In Queue",
    description: "Your order is waiting to be prepared",
    color: "#D7B66E", // Gold
    progress: 25,
    icon: "⏳",
  },
  PREPPING: {
    label: "Preparing",
    description: "Our chefs are making your bowl fresh!",
    color: "#C7A660", // Darker gold
    progress: 50,
    icon: "🔥",
  },
  READY: {
    label: "Ready!",
    description: "Your order is ready - we're bringing it to you!",
    color: "#22c55e", // Green for ready
    progress: 75,
    icon: "✨",
  },
  SERVING: {
    label: "Enjoy!",
    description: "Your order has been delivered. Enjoy your meal!",
    color: "#22c55e", // Green
    progress: 100,
    icon: "🍜",
  },
  COMPLETED: {
    label: "Completed",
    description: "Thank you for dining with us!",
    color: "#910C1E", // CNY Red
    progress: 100,
    icon: "🎉",
  },
};

function StatusContent() {
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qrCode");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI Features state
  const [commentary, setCommentary] = useState<OrderCommentary | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const lastCommentaryStatusRef = useRef<string | null>(null);

  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [fortuneOpened, setFortuneOpened] = useState(false);

  // Zodiac insights state
  const [zodiac, setZodiac] = useState<ZodiacInsights | null>(null);
  const [zodiacLoading, setZodiacLoading] = useState(false);
  const zodiacFetchedRef = useRef(false);

  // Get first name from order
  const firstName = order?.guestName?.split(" ")[0] || null;

  // Fetch live commentary
  async function fetchCommentary(currentStatus: string, orderQrCode: string) {
    if (!orderQrCode || commentaryLoading) return;
    if (!["QUEUED", "PREPPING", "READY", "SERVING"].includes(currentStatus)) return;
    if (currentStatus === lastCommentaryStatusRef.current) return;

    setCommentaryLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/orders/commentary?orderQrCode=${encodeURIComponent(orderQrCode)}&locale=en`,
        { headers: { "x-tenant-slug": "oh" } }
      );

      if (response.ok) {
        const data = await response.json();
        setCommentary(data);
        lastCommentaryStatusRef.current = currentStatus;
      }
    } catch (err) {
      console.error("Failed to fetch commentary:", err);
    } finally {
      setCommentaryLoading(false);
    }
  }

  // Fetch fortune cookie
  async function fetchFortune() {
    if (!qrCode || fortuneLoading) return;

    setFortuneLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/orders/fortune?orderQrCode=${encodeURIComponent(qrCode)}&locale=en`,
        { headers: { "x-tenant-slug": "oh" } }
      );

      if (response.ok) {
        const data = await response.json();
        setFortune(data);
      }
    } catch (err) {
      console.error("Failed to fetch fortune:", err);
    } finally {
      setFortuneLoading(false);
    }
  }

  // Fetch zodiac insights
  async function fetchZodiacInsights(guestName: string) {
    if (!guestName || zodiacLoading || zodiacFetchedRef.current) return;

    zodiacFetchedRef.current = true;
    setZodiacLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/orders/zodiac-insights?guestName=${encodeURIComponent(guestName)}`,
        { headers: { "x-tenant-slug": "oh" } }
      );

      if (response.ok) {
        const data = await response.json();
        setZodiac(data);
      }
    } catch (err) {
      console.error("Failed to fetch zodiac insights:", err);
    } finally {
      setZodiacLoading(false);
    }
  }

  useEffect(() => {
    if (!qrCode) {
      setError("No order code provided");
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `${API_URL}/orders/status?orderQrCode=${encodeURIComponent(qrCode)}`,
          { headers: { "x-tenant-slug": "oh" } }
        );
        if (!response.ok) {
          throw new Error("Order not found");
        }
        const data = await response.json();

        // API returns { order: { ... } } - extract the order object
        const orderData = data.order;

        if (!orderData) {
          throw new Error("Order data missing");
        }

        setOrder(orderData);
        setError("");

        // Fetch commentary when status is in active cooking stages
        if (orderData.status) {
          fetchCommentary(orderData.status, qrCode);
        }

        // Fetch zodiac insights (only once)
        if (orderData.guestName && !zodiacFetchedRef.current) {
          fetchZodiacInsights(orderData.guestName);
        }
      } catch (err) {
        console.error("Failed to fetch order status:", err);
        setError("Could not find your order");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Poll every 10 seconds for more responsive updates
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [qrCode]);

  if (loading) {
    return (
      <div className="cny-page cny-page-3">
        <AnimatedBackground theme="gold" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <p style={{ color: "#D7B66E", fontSize: "1.2rem" }}>
            Loading your order...
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="cny-page cny-page-3">
        <AnimatedBackground theme="gold" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#D7B66E", fontSize: "1.2rem", marginBottom: "16px" }}>
            {error || "Order not found"}
          </p>
          <a
            href="/en/cny/order"
            className="cny-button"
            style={{ textDecoration: "none" }}
          >
            Place an Order
          </a>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.QUEUED;

  return (
    <div className="cny-page cny-page-3">
      <AnimatedBackground theme="gold" />

      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          padding: "0 24px",
          overflowY: "auto",
          paddingBottom: "40px",
        }}
      >
        {/* Order Title */}
        <div style={{ textAlign: "center", maxWidth: "350px", marginTop: "12px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(1.1rem, 5vw, 1.4rem)",
              fontWeight: 700,
              color: "#D7B66E",
              fontFamily: "'Raleway', sans-serif",
              lineHeight: 1.3,
            }}
          >
            {firstName ? `${firstName}'s` : "Your"} CNY 2026 Party Order
          </h1>
        </div>

        {/* Status Badge */}
        <div
          style={{
            background: statusConfig.color,
            borderRadius: "50px",
            padding: "8px 20px",
            boxShadow: `0 0 20px ${statusConfig.color}40`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: statusConfig.color === "#D7B66E" || statusConfig.color === "#C7A660" ? "#910C1E" : "white",
              fontFamily: "'Raleway', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            {statusConfig.icon} {statusConfig.label}
          </p>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            maxWidth: "300px",
            height: "8px",
            background: "rgba(215, 182, 110, 0.2)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${statusConfig.progress}%`,
              height: "100%",
              background: "#D7B66E",
              borderRadius: "4px",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Live AI Kitchen Commentary - Compact (hide after served) */}
        {["QUEUED", "PREPPING", "READY"].includes(order.status) && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(145, 12, 30, 0.95) 0%, rgba(100, 8, 20, 0.95) 100%)",
              borderRadius: "12px",
              padding: "12px 16px",
              maxWidth: "350px",
              width: "100%",
              border: "1px solid rgba(215, 182, 110, 0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>
                {statusConfig.icon}
              </span>
              <p
                style={{
                  color: "#fff",
                  fontSize: "0.9rem",
                  margin: 0,
                  fontStyle: "italic",
                  fontFamily: "'Raleway', sans-serif",
                  lineHeight: 1.4,
                }}
              >
                {commentaryLoading
                  ? "Listening to the kitchen..."
                  : commentary?.commentary
                    ? (() => {
                        // Get first 1-2 sentences, ensuring we don't cut mid-thought
                        const text = commentary.commentary;
                        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                        const firstTwo = sentences.slice(0, 2).join(" ").trim();
                        // If still too short or no punctuation, use full text up to ~150 chars
                        if (firstTwo.length < 50 && text.length > firstTwo.length) {
                          const truncated = text.slice(0, 150);
                          const lastSpace = truncated.lastIndexOf(" ");
                          return lastSpace > 100 ? truncated.slice(0, lastSpace) + "..." : truncated + "...";
                        }
                        return firstTwo || text;
                      })()
                    : statusConfig.description
                }
              </p>
            </div>
          </div>
        )}

        {/* Order Items - Compact */}
        {order.items && order.items.length > 0 && (
          <div
            style={{
              background: "rgba(145, 12, 30, 0.3)",
              borderRadius: "12px",
              padding: "12px 16px",
              maxWidth: "350px",
              width: "100%",
              border: "1px solid rgba(215, 182, 110, 0.2)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "#D7B66E",
                fontFamily: "'Raleway', sans-serif",
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 600, color: "rgba(215, 182, 110, 0.7)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "0.75rem" }}>
                Your Order:{" "}
              </span>
              {order.items.map((item, index) => (
                <span key={item.id || index}>
                  {item.name || "Item"}
                  {item.selectedValue && ` (${item.selectedValue})`}
                  {index < order.items.length - 1 && ", "}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* Zodiac Insights Section */}
        {(zodiac || zodiacLoading) && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(145, 12, 30, 0.9) 0%, rgba(100, 8, 20, 0.9) 100%)",
              borderRadius: "12px",
              padding: "14px 16px",
              maxWidth: "350px",
              width: "100%",
              border: "1px solid rgba(215, 182, 110, 0.3)",
            }}
          >
            {zodiacLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "8px 0" }}>
                <span style={{ fontSize: "1.5rem", animation: "pulse 1s infinite" }}>✨</span>
                <p style={{ color: "#D7B66E", fontSize: "0.9rem", margin: 0, fontFamily: "'Raleway', sans-serif" }}>
                  Reading the stars...
                </p>
              </div>
            ) : zodiac ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Zodiac Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{zodiac.zodiacEmoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#D7B66E", fontFamily: "'Raleway', sans-serif" }}>
                      {firstName || zodiac.firstName} • {zodiac.zodiac}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(215, 182, 110, 0.6)", fontFamily: "'Raleway', sans-serif" }}>
                      Your Chinese Zodiac
                    </p>
                  </div>
                </div>

                {/* Horse Year Advice */}
                <div style={{ background: "rgba(215, 182, 110, 0.1)", borderRadius: "8px", padding: "8px 10px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "rgba(215, 182, 110, 0.7)", fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Year of the Horse • Message to {firstName || zodiac.firstName}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#fff", fontFamily: "'Raleway', sans-serif", lineHeight: 1.4 }}>
                    {zodiac.horseYearAdvice}
                  </p>
                </div>

                {/* Who to Hang Out With */}
                {zodiac.compatibleGuests.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "rgba(215, 182, 110, 0.6)", fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ✨ Seek out at tonight's party!
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#D7B66E", fontFamily: "'Raleway', sans-serif", lineHeight: 1.4 }}>
                      {zodiac.compatibleGuests.slice(0, 4).map((g, i) => (
                        <span key={i}>
                          {g.name.split(" ")[0]} <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>({g.zodiac})</span>
                          {i < Math.min(zodiac.compatibleGuests.length, 4) - 1 && ", "}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {/* Who to Avoid (Fun!) */}
                {zodiac.avoidGuests.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "rgba(215, 182, 110, 0.6)", fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      😈 Watch out for tonight!
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#D7B66E", fontFamily: "'Raleway', sans-serif", lineHeight: 1.4 }}>
                      {zodiac.avoidGuests.slice(0, 3).map((g, i) => (
                        <span key={i}>
                          {g.name.split(" ")[0]} <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>({g.zodiac})</span>
                          {i < Math.min(zodiac.avoidGuests.length, 3) - 1 && ", "}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Digital Fortune Cookie - Compact */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(145, 12, 30, 0.9) 0%, rgba(100, 8, 20, 0.9) 100%)",
            borderRadius: "12px",
            padding: "12px 16px",
            maxWidth: "350px",
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(215, 182, 110, 0.3)",
          }}
        >
          {!fortuneOpened ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <span style={{ fontSize: "2rem" }}>🥠</span>
              <button
                onClick={() => {
                  setFortuneOpened(true);
                  fetchFortune();
                }}
                className="cny-button"
                style={{
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                }}
              >
                CRACK IT OPEN{firstName ? `, ${firstName}` : ""}!
              </button>
            </div>
          ) : fortuneLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "4px 0" }}>
              <span style={{ fontSize: "1.5rem", animation: "pulse 1s infinite" }}>✨</span>
              <p style={{ color: "#D7B66E", fontSize: "0.9rem", margin: 0, fontFamily: "'Raleway', sans-serif" }}>
                Reading the stars...
              </p>
            </div>
          ) : fortune ? (
            <div style={{ padding: "4px 0" }}>
              {/* Fortune Message */}
              <p
                style={{
                  fontStyle: "italic",
                  fontSize: "0.95rem",
                  color: "#fff",
                  margin: "0 0 10px",
                  lineHeight: 1.5,
                  fontFamily: "'Raleway', sans-serif",
                }}
              >
                🥠 "{fortune.fortune}"
              </p>

              {/* Lucky Numbers - Compact */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.7rem", color: "#D7B66E", fontFamily: "'Raleway', sans-serif", textTransform: "uppercase" }}>
                  Lucky #s:
                </span>
                {fortune.luckyNumbers.map((num, i) => (
                  <span
                    key={i}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "#D7B66E",
                      color: "#910C1E",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                      fontFamily: "'Raleway', sans-serif",
                    }}
                  >
                    {num}
                  </span>
                ))}
              </div>

              {/* Learn Chinese - Compact inline */}
              {fortune.learnChinese && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    background: "rgba(215, 182, 110, 0.15)",
                    borderRadius: "8px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#D7B66E", fontFamily: "'Raleway', sans-serif" }}>
                    <span style={{ fontSize: "1.2rem", marginRight: "6px" }}>{fortune.learnChinese.traditional}</span>
                    <span style={{ fontWeight: 600 }}>{fortune.learnChinese.pinyin}</span>
                    {" = "}
                    {fortune.learnChinese.english}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "rgba(215, 182, 110, 0.7)", fontSize: "0.85rem", margin: "4px 0", fontFamily: "'Raleway', sans-serif" }}>
              Fortune unavailable
            </p>
          )}
        </div>

        {/* Auto-refresh notice */}
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.75rem",
            color: "rgba(215, 182, 110, 0.5)",
            fontFamily: "'Raleway', sans-serif",
            textAlign: "center",
          }}
        >
          This page updates automatically
        </p>

        {/* Horse mascot */}
        <img
          src="/cny/horse.svg"
          alt="Year of the Horse"
          className="cny-horse-animated"
          style={{
            marginTop: "16px",
            marginBottom: "60px",
            width: "clamp(240px, 60vw, 360px)",
            maxWidth: "80vw",
            height: "auto",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function CNYOrderStatus() {
  return (
    <Suspense
      fallback={
        <div className="cny-page cny-page-3">
          <AnimatedBackground theme="gold" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <p style={{ color: "#D7B66E", fontSize: "1.2rem" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
