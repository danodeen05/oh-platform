"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function ReferralDashboard() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function createUser() {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    setLoading(true);
    const response = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const userData = await response.json();
    setUser(userData);
    localStorage.setItem("userId", userData.id);
    loadCredits(userData.id);
    setLoading(false);
  }

  async function loadCredits(userId: string) {
    const response = await fetch(`${BASE}/users/${userId}/credits`);
    const data = await response.json();
    setCredits(data);
  }

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      fetch(`${BASE}/users/${savedUserId}/credits`)
        .then((r) => r.json())
        .then((data) => {
          setCredits(data);
          setUser({ id: savedUserId });
        });
    }
  }, []);

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: "0 auto",
          padding: 32,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ marginBottom: 16 }}>Get Started</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>
          Enter your email to get your referral link
        </p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "1rem",
          }}
        />
        <button
          onClick={createUser}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#7C7A67",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : "Get My Referral Link"}
        </button>
      </div>
    );
  }

  const referralUrl = `${window.location.origin}/order?ref=${credits?.referralCode}`;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Credits Balance */}
      <div
        style={{
          background: "#7C7A67",
          color: "white",
          padding: 32,
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: 8 }}>
          Your Credits
        </div>
        <div style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: 4 }}>
          ${((credits?.balance || 0) / 100).toFixed(2)}
        </div>
        <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>Use at checkout</div>
      </div>

      {/* Referral Link */}
      <div
        style={{
          padding: 24,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 16 }}>Your Referral Link</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 12,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            value={referralUrl}
            readOnly
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.9rem",
              color: "#7C7A67",
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(referralUrl);
              alert("Link copied!");
            }}
            style={{
              padding: "8px 16px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "bold",
            }}
          >
            Copy
          </button>
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#666",
            margin: 0,
            marginTop: 12,
          }}
        >
          Share this link to earn $5 for every friend who orders
        </p>
      </div>

      {/* Recent Activity */}
      {credits?.events && credits.events.length > 0 && (
        <div
          style={{
            padding: 24,
            background: "white",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 16 }}>Recent Activity</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {credits.events.slice(0, 10).map((event: any) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                    {event.description || event.type}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>
                    {new Date(event.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: "bold",
                    color: event.amountCents > 0 ? "#22c55e" : "#ef4444",
                  }}
                >
                  {event.amountCents > 0 ? "+" : ""}$
                  {(event.amountCents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
