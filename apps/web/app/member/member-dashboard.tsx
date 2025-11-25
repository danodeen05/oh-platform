"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TierBenefits = {
  referralBonus: number;
  cashbackPercent: number;
  birthdayBonus: number;
  perks: string[];
};

type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconEmoji: string;
  category: string;
  earnedAt?: string;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  membershipTier: string;
  creditsCents: number;
  referralCode: string;
  lifetimeOrderCount: number;
  lifetimeSpentCents: number;
  currentStreak: number;
  longestStreak: number;
  tierBenefits: TierBenefits;
  tierProgress: any;
  nextTier: any;
  badges: Array<{ badge: Badge; earnedAt: string }>;
};

export default function MemberDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      setUserId(savedUserId);
      loadProfile(savedUserId);
    }
    loadAllBadges();
  }, []);

  async function loadProfile(uid: string) {
    try {
      setLoading(true);
      const url = `${BASE}/users/${uid}/profile`;
      console.log("BASE:", BASE);
      console.log("Fetching profile from:", url);
      const response = await fetch(url);
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Profile data received:", data);
      console.log("Has badges?", data.badges);
      console.log("Has tierBenefits?", data.tierBenefits);
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setLoading(false);
    }
  }

  async function loadAllBadges() {
    try {
      const response = await fetch(`${BASE}/badges`);
      const data = await response.json();
      setAllBadges(data);
    } catch (error) {
      console.error("Failed to load badges:", error);
    }
  }

  async function handleLogin() {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const userData = await response.json();
      setUserId(userData.id);
      localStorage.setItem("userId", userData.id);
      loadProfile(userData.id);
    } catch (error) {
      console.error("Failed to create user:", error);
      setLoading(false);
    }
  }

  function getTierColor(tier: string) {
    const colors = {
      CHOPSTICK: "#f59e0b",
      NOODLE_MASTER: "#8b5cf6",
      BEEF_BOSS: "#ef4444",
    };
    return colors[tier as keyof typeof colors] || "#667eea";
  }

  function getTierName(tier: string) {
    const names = {
      CHOPSTICK: "🥢 Chopstick",
      NOODLE_MASTER: "🍜 Noodle Master",
      BEEF_BOSS: "🐂 Beef Boss",
    };
    return names[tier as keyof typeof names] || tier;
  }

  if (!userId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            background: "white",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: "1.8rem",
              textAlign: "center",
            }}
          >
            Welcome! 🍜
          </h1>
          <p style={{ color: "#666", marginBottom: 24, textAlign: "center" }}>
            Sign in to view your membership
          </p>

          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: "1rem",
              marginBottom: 16,
            }}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍜</div>
          <div>Loading your profile...</div>
        </div>
      </div>
    );
  }

  const tierColor = getTierColor(profile.membershipTier);
  const earnedBadgeIds = (profile.badges || []).map((b) => b.badge.id);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          background: "rgba(0,0,0,0.2)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "white", fontSize: "1.3rem" }}>
          My Membership
        </h1>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "rgba(255,255,255,0.2)",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Home
        </button>
      </div>

      {/* Tier Card */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}
              >
                Current Tier
              </div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: "bold",
                  color: tierColor,
                }}
              >
                {getTierName(profile.membershipTier)}
              </div>
            </div>
            <div
              style={{
                background: tierColor + "20",
                color: tierColor,
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: "bold",
                fontSize: "1.5rem",
              }}
            >
              {profile.membershipTier === "CHOPSTICK" && "🥢"}
              {profile.membershipTier === "NOODLE_MASTER" && "🍜"}
              {profile.membershipTier === "BEEF_BOSS" && "🐂"}
            </div>
          </div>

          {/* Tier Benefits */}
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 12 }}>
              Your Benefits:
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {profile.tierBenefits.perks.map((perk, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ color: tierColor }}>✓</span>
                  <span style={{ fontSize: "0.9rem" }}>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress to Next Tier */}
          {profile.nextTier && (
            <div>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  marginBottom: 12,
                }}
              >
                Progress to {getTierName(profile.nextTier.next)}:
              </div>

              {/* Orders Progress */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    marginBottom: 4,
                  }}
                >
                  <span>Orders</span>
                  <span>
                    {profile.tierProgress.orders.current} /{" "}
                    {profile.tierProgress.orders.needed}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: tierColor,
                      width: `${profile.tierProgress.orders.percent}%`,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              {/* Referrals Progress */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    marginBottom: 4,
                  }}
                >
                  <span>Referrals</span>
                  <span>
                    {profile.tierProgress.referrals.current} /{" "}
                    {profile.tierProgress.referrals.needed}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: tierColor,
                      width: `${profile.tierProgress.referrals.percent}%`,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: tierColor }}
            >
              {profile.lifetimeOrderCount}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              Total Orders
            </div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: tierColor }}
            >
              ${(profile.creditsCents / 100).toFixed(0)}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>Credits</div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: tierColor }}
            >
              {profile.currentStreak}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>Day Streak</div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: tierColor }}
            >
              {(profile.badges || []).length}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>Badges</div>
          </div>
        </div>

        {/* Badges */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 16 }}>Badges</h2>

          <div style={{ display: "grid", gap: 12 }}>
            {allBadges.map((badge) => {
              const earned = earnedBadgeIds.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: earned ? "#f0fdf4" : "#f9fafb",
                    borderRadius: 12,
                    border: earned ? "2px solid #22c55e" : "1px solid #e5e7eb",
                    opacity: earned ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      fontSize: "2rem",
                      width: 48,
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: earned ? "#dcfce7" : "#f3f4f6",
                      borderRadius: 12,
                    }}
                  >
                    {badge.iconEmoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                      {badge.name}
                      {earned && (
                        <span style={{ color: "#22c55e", marginLeft: 8 }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {badge.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "white",
          borderTop: "1px solid #e5e7eb",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <button
          onClick={() => router.push("/order")}
          style={{
            padding: 16,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🍜</span>
          <span style={{ fontSize: "0.75rem", color: "#666" }}>Order</span>
        </button>

        <button
          onClick={() => router.push("/referral")}
          style={{
            padding: 16,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>💰</span>
          <span style={{ fontSize: "0.75rem", color: "#666" }}>Referrals</span>
        </button>

        <button
          style={{
            padding: 16,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>👤</span>
          <span
            style={{
              fontSize: "0.75rem",
              color: tierColor,
              fontWeight: "bold",
            }}
          >
            Member
          </span>
        </button>
      </div>
    </div>
  );
}
