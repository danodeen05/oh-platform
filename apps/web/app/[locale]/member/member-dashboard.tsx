"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

type Order = {
  id: string;
  createdAt: string;
};

// Mini Calendar Component for Member Page - matches stats card width
function OrderCalendar({ orders, tierColor }: { orders: Order[]; tierColor: string }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();

  // Check if we're viewing current month (to disable forward nav)
  const isCurrentMonth = viewDate.getMonth() === today.getMonth() &&
                         viewDate.getFullYear() === today.getFullYear();

  const goToPreviousMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    if (!isCurrentMonth) {
      setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const orderDaysThisMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const days = new Set<number>();

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate.getFullYear() === year && orderDate.getMonth() === month) {
        days.add(orderDate.getDate());
      }
    });

    return days;
  }, [orders, viewDate]);

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    return { year, month, daysInMonth, startingDay };
  }, [viewDate]);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === calendarData.month &&
    today.getFullYear() === calendarData.year;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < calendarData.startingDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= calendarData.daysInMonth; day++) {
    calendarDays.push(day);
  }

  const orderCount = orderDaysThisMonth.size;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 12,
        textAlign: "center",
      }}
    >
      {/* Month/Year with navigation arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 2 }}>
        <button
          onClick={goToPreviousMonth}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "1.8rem",
            cursor: "pointer",
            color: tierColor,
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: tierColor }}>
          {monthNames[calendarData.month]} {calendarData.year}
        </div>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "1.8rem",
            cursor: isCurrentMonth ? "default" : "pointer",
            color: isCurrentMonth ? "#ddd" : tierColor,
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>
      <div style={{ fontSize: "1rem", color: "#666", marginBottom: 6 }}>
        {orderCount} {orderCount === 1 ? "visit" : "visits"} this month
      </div>

      {/* Day Headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0,
        }}
      >
        {dayNames.map((day, idx) => (
          <div
            key={idx}
            style={{
              textAlign: "center",
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "#888",
              padding: "2px 0",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - compact cells */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} style={{ height: 24 }} />;
          }

          const hasOrder = orderDaysThisMonth.has(day);
          const isTodayCell = isToday(day);

          return (
            <div
              key={day}
              style={{
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                padding: 2,
                background: hasOrder
                  ? "linear-gradient(135deg, #C7A878 0%, #7C7A67 100%)"
                  : isTodayCell
                    ? "rgba(124, 122, 103, 0.15)"
                    : "transparent",
                border: isTodayCell && !hasOrder ? "1px solid #7C7A67" : "none",
              }}
            >
              {hasOrder ? (
                <Image
                  src="/Oh_Logo_Mark_Web.png"
                  alt="Order day"
                  width={20}
                  height={20}
                  style={{
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: isTodayCell ? "700" : "400",
                    color: isTodayCell ? "#7C7A67" : "#888",
                  }}
                >
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MemberDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      setUserId(savedUserId);
      loadProfile(savedUserId);
      loadOrders(savedUserId);
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

  async function loadOrders(uid: string) {
    try {
      const response = await fetch(`${BASE}/users/${uid}/orders`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders:", error);
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
      CHOPSTICK: "#C7A878", // Natural Tan
      NOODLE_MASTER: "#7C7A67", // Subtle Olive
      BEEF_BOSS: "#222222", // Soft Black
    };
    return colors[tier as keyof typeof colors] || "#7C7A67";
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
              background: "#7C7A67",
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
          background: "#222222",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "#E5E5E5", fontSize: "1.3rem" }}>
          My Membership
        </h1>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "#7C7A67",
            color: "#E5E5E5",
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
            onClick={() => router.push("/member/orders")}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
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
            onClick={() => router.push("/member/credits")}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: tierColor }}
            >
              ${(profile.creditsCents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>Credits</div>
          </div>
        </div>

        {/* Order Calendar - Centered below stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 400 }}>
            <OrderCalendar orders={orders} tierColor={tierColor} />
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
                    background: earned ? "rgba(124, 122, 103, 0.1)" : "#f9fafb",
                    borderRadius: 12,
                    border: earned ? "2px solid #7C7A67" : "1px solid #e5e7eb",
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
                      background: earned ? "rgba(199, 168, 120, 0.2)" : "#f3f4f6",
                      borderRadius: 12,
                    }}
                  >
                    {badge.iconEmoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                      {badge.name}
                      {earned && (
                        <span style={{ color: "#7C7A67", marginLeft: 8 }}>
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
