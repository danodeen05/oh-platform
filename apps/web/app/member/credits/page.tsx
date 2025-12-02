"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type CreditEvent = {
  id: string;
  type: string;
  amountCents: number;
  description: string;
  createdAt: string;
  orderId?: string;
};

type CreditData = {
  balance: number;
  referralCode: string;
  events: CreditEvent[];
};

export default function CreditsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditData | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/member");
      return;
    }
    loadCredits(userId);
  }, []);

  async function loadCredits(userId: string) {
    try {
      const response = await fetch(`${BASE}/users/${userId}/credits`);
      const data = await response.json();
      setCredits(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load credits:", error);
      setLoading(false);
    }
  }

  function getEventIcon(type: string) {
    const icons: Record<string, string> = {
      CASHBACK: "💰",
      REFERRAL_SIGNUP: "🎁",
      REFERRAL_ORDER: "👥",
      PURCHASE: "🛒",
      BONUS: "⭐",
      REFUND: "↩️",
    };
    return icons[type] || "•";
  }

  function getEventColor(type: string) {
    const colors: Record<string, string> = {
      CASHBACK: "#22c55e",
      REFERRAL_SIGNUP: "#8b5cf6",
      REFERRAL_ORDER: "#f59e0b",
      PURCHASE: "#ef4444",
      BONUS: "#3b82f6",
      REFUND: "#06b6d4",
    };
    return colors[type] || "#666";
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>💰</div>
          <div>Loading credits...</div>
        </div>
      </div>
    );
  }

  if (!credits) {
    return (
      <div style={{ minHeight: "100vh", padding: 24 }}>
        <p>Failed to load credits</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80, background: "#f9fafb" }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          padding: "16px 24px",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Credits</h1>
        </div>
      </div>

      {/* Balance Card */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            color: "white",
          }}
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: 8 }}>
            Available Balance
          </div>
          <div style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: 16 }}>
            ${(credits.balance / 100).toFixed(2)}
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.85rem",
              display: "inline-block",
            }}
          >
            {credits.events.length} transaction{credits.events.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <h2 style={{ margin: 0, marginBottom: 16, fontSize: "1.1rem" }}>
            Transaction History
          </h2>

          {credits.events.length === 0 ? (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 32,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>💳</div>
              <div style={{ color: "#666" }}>No transactions yet</div>
              <div style={{ fontSize: "0.85rem", color: "#999", marginTop: 8 }}>
                Complete your first order to earn cashback credits
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {credits.events.map((event) => {
                const isCredit = event.amountCents > 0;
                const color = getEventColor(event.type);

                return (
                  <div
                    key={event.id}
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: color + "20",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                      }}
                    >
                      {getEventIcon(event.type)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                        {event.description}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        {formatDate(event.createdAt)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: "bold",
                        color: isCredit ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {isCredit ? "+" : "-"}${Math.abs(event.amountCents / 100).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
