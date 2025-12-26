"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/components/ui/Toast";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

type BadgeProgress = {
  current: number;
  required: number;
  percent: number;
  earned: boolean;
  description?: string;
};

type Challenge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  rewardCents: number;
  iconEmoji: string;
  requirements: { type: string; target: number };
};

type UserChallenge = {
  id: string;
  challengeId: string;
  challenge: Challenge;
  progress: { current: number };
  completedAt: string | null;
  rewardClaimed: boolean;
};

// Tier icon component that uses PNG files with transparent backgrounds
function TierIcon({ tier, size = 40, invert = false }: { tier: string; size?: number; invert?: boolean }) {
  const tierKeyMap: Record<string, string> = {
    CHOPSTICK: "chopstick",
    NOODLE_MASTER: "noodle-master",
    BEEF_BOSS: "beef-boss",
  };
  const tierKey = tierKeyMap[tier] || "chopstick";
  const iconPath = `/tiers/${tierKey}.png`;

  return (
    <Image
      src={iconPath}
      alt={tier}
      width={size}
      height={size}
      style={{
        objectFit: "contain",
        filter: invert ? "invert(1)" : "none",
      }}
    />
  );
}

// Mini Calendar Component for Member Page - matches stats card width
function OrderCalendar({ orders, tierColor, t }: { orders: Order[]; tierColor: string; t: (key: string, values?: Record<string, any>) => string }) {
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
        {t("visitsThisMonth", { count: orderCount })}
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
  const locale = useLocale();
  const t = useTranslations("member");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<Record<string, BadgeProgress>>({});
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      setUserId(savedUserId);
      loadProfile(savedUserId);
      loadOrders(savedUserId);
      loadBadgeProgress(savedUserId);
      loadUserChallenges(savedUserId);
    }
    loadAllBadges();
    loadAvailableChallenges();
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

  async function loadBadgeProgress(uid: string) {
    try {
      const response = await fetch(`${BASE}/users/${uid}/badge-progress`);
      const data = await response.json();
      setBadgeProgress(data.progress || {});
    } catch (error) {
      console.error("Failed to load badge progress:", error);
    }
  }

  async function loadUserChallenges(uid: string) {
    try {
      const response = await fetch(`${BASE}/users/${uid}/challenges`);
      const data = await response.json();
      setUserChallenges(data);
    } catch (error) {
      console.error("Failed to load user challenges:", error);
    }
  }

  async function loadAvailableChallenges() {
    try {
      const response = await fetch(`${BASE}/challenges`);
      const data = await response.json();
      setAvailableChallenges(data);
    } catch (error) {
      console.error("Failed to load challenges:", error);
    }
  }

  async function enrollInChallenge(challengeId: string) {
    if (!userId) return;
    try {
      const response = await fetch(`${BASE}/users/${userId}/challenges/${challengeId}/enroll`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success(t("challengeEnrolled"));
        loadUserChallenges(userId);
      }
    } catch (error) {
      console.error("Failed to enroll in challenge:", error);
    }
  }

  async function claimChallengeReward(challengeId: string) {
    if (!userId) return;
    try {
      const response = await fetch(`${BASE}/users/${userId}/challenges/${challengeId}/claim`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(t("rewardClaimed", { amount: (data.rewardCents / 100).toFixed(2) }));
        loadUserChallenges(userId);
        loadProfile(userId);
      }
    } catch (error) {
      console.error("Failed to claim reward:", error);
    }
  }

  async function handleLogin() {
    if (!email) {
      toast.warning(tCommon("enterEmail"));
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
      loadBadgeProgress(userData.id);
      loadUserChallenges(userData.id);
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
    const tierKeys: Record<string, string> = {
      CHOPSTICK: "tiers.chopstick",
      NOODLE_MASTER: "tiers.noodleMaster",
      BEEF_BOSS: "tiers.beefBoss",
    };
    const key = tierKeys[tier];
    return key ? t(key) : tier;
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
            {t("welcome")} 🍜
          </h1>
          <p style={{ color: "#666", marginBottom: 24, textAlign: "center" }}>
            {t("signInToView")}
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
            {loading ? t("loading") : t("continue")}
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
          <div>{t("loadingProfile")}</div>
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
          {t("myMembership")}
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
          {t("home")}
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
                {t("currentTier")}
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
                padding: "12px",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TierIcon tier={profile.membershipTier} size={48} />
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
              {t("yourBenefits")}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {profile.tierBenefits.perks.map((perkKey, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ color: tierColor }}>✓</span>
                  <span style={{ fontSize: "0.9rem" }}>{t(`perks.${perkKey}`)}</span>
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
                {t("progressTo", { tier: getTierName(profile.nextTier.next) })}
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
                  <span>{t("orders")}</span>
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
                  <span>{t("referralsNav")}</span>
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
              {t("totalOrders")}
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
            <div style={{ fontSize: "0.85rem", color: "#666" }}>{t("credits")}</div>
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
            <OrderCalendar orders={orders} tierColor={tierColor} t={t} />
          </div>
        </div>

        {/* Challenges Section */}
        {(userChallenges.length > 0 || availableChallenges.length > 0) && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 16 }}>{t("challengesTitle")}</h2>

            {/* Active Challenges */}
            {userChallenges.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: "0.9rem", color: "#666", marginBottom: 12 }}>{t("activeChallenges")}</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {userChallenges.map((uc) => {
                    const progress = uc.progress?.current || 0;
                    const target = uc.challenge.requirements.target || 1;
                    const percent = Math.min(100, (progress / target) * 100);
                    const isCompleted = !!uc.completedAt;

                    return (
                      <div
                        key={uc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          background: isCompleted ? "rgba(124, 122, 103, 0.1)" : "#f9fafb",
                          borderRadius: 12,
                          border: isCompleted ? "2px solid #7C7A67" : "1px solid #e5e7eb",
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
                            background: isCompleted ? "rgba(199, 168, 120, 0.2)" : "#f3f4f6",
                            borderRadius: 12,
                          }}
                        >
                          {uc.challenge.iconEmoji}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                            {uc.challenge.name}
                            {isCompleted && !uc.rewardClaimed && (
                              <span style={{ color: "#22c55e", marginLeft: 8 }}>
                                {t("completed")}
                              </span>
                            )}
                            {uc.rewardClaimed && (
                              <span style={{ color: "#7C7A67", marginLeft: 8 }}>
                                {t("claimed")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 6 }}>
                            {uc.challenge.description}
                          </div>
                          {!isCompleted && (
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "0.75rem",
                                  color: "#888",
                                  marginBottom: 4,
                                }}
                              >
                                <span>{progress} / {target}</span>
                                <span>{Math.round(percent)}%</span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: "#e5e7eb",
                                  borderRadius: 3,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    background: tierColor,
                                    width: `${percent}%`,
                                    transition: "width 0.3s",
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {isCompleted && !uc.rewardClaimed && (
                            <button
                              onClick={() => claimChallengeReward(uc.challengeId)}
                              style={{
                                marginTop: 8,
                                padding: "6px 12px",
                                background: tierColor,
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                              }}
                            >
                              {t("claimReward", { amount: (uc.challenge.rewardCents / 100).toFixed(2) })}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Challenges (not enrolled) */}
            {availableChallenges.filter(c => !userChallenges.some(uc => uc.challengeId === c.id)).length > 0 && (
              <div>
                <h3 style={{ fontSize: "0.9rem", color: "#666", marginBottom: 12 }}>{t("availableChallenges")}</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {availableChallenges
                    .filter(c => !userChallenges.some(uc => uc.challengeId === c.id))
                    .map((challenge) => (
                      <div
                        key={challenge.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          background: "#f9fafb",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
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
                            background: "#f3f4f6",
                            borderRadius: 12,
                          }}
                        >
                          {challenge.iconEmoji}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                            {challenge.name}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}>
                            {challenge.description}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: tierColor, fontWeight: "bold" }}>
                            {t("reward")}: ${(challenge.rewardCents / 100).toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => enrollInChallenge(challenge.id)}
                          style={{
                            padding: "8px 16px",
                            background: tierColor,
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "bold",
                          }}
                        >
                          {t("join")}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 16 }}>{t("badgesTitle")}</h2>

          <div style={{ display: "grid", gap: 12 }}>
            {allBadges.map((badge) => {
              const earned = earnedBadgeIds.includes(badge.id);
              const progress = badgeProgress[badge.slug];
              const hasProgress = progress && progress.required > 1 && !earned;
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
                    opacity: earned ? 1 : 0.7,
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
                      {t(`badges.${badge.slug}.name`, { defaultValue: badge.name })}
                      {earned && (
                        <span style={{ color: "#7C7A67", marginLeft: 8 }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: hasProgress ? 6 : 0 }}>
                      {t(`badges.${badge.slug}.description`, { defaultValue: badge.description })}
                    </div>
                    {/* Progress bar for unearned badges */}
                    {hasProgress && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            color: "#888",
                            marginBottom: 4,
                          }}
                        >
                          <span>{progress.current} / {progress.required}</span>
                          <span>{Math.round(progress.percent)}%</span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "#e5e7eb",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              background: tierColor,
                              width: `${progress.percent}%`,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    )}
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
          <span style={{ fontSize: "0.75rem", color: "#666" }}>{t("order")}</span>
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
          <span style={{ fontSize: "0.75rem", color: "#666" }}>{t("referralsNav")}</span>
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
            {t("memberNav")}
          </span>
        </button>
      </div>
    </div>
  );
}
