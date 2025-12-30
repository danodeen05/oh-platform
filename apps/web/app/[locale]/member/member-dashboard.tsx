"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { setUserProperties } from "@/lib/analytics";

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

type MealGift = {
  id: string;
  amountCents: number;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  messageFromGiver?: string;
  createdAt: string;
  acceptedAt?: string;
  expiredAt?: string;
  location: { id: string; name: string; city: string };
  giver?: { id: string; name: string };
  acceptedBy?: { id: string; name: string };
  chain?: Array<{ messageFromRecipient?: string; createdAt: string }>;
};

type MealGifts = {
  given: MealGift[];
  received: MealGift[];
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
  const tMealGift = useTranslations("mealGift");
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<Record<string, BadgeProgress>>({});
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [mealGifts, setMealGifts] = useState<MealGifts>({ given: [], received: [] });
  const [loading, setLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState<{ apple: boolean; google: boolean } | null>(null);
  const [showTiersModal, setShowTiersModal] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId) {
      setUserId(savedUserId);
      loadProfile(savedUserId);
      loadOrders(savedUserId);
      loadBadgeProgress(savedUserId);
      loadUserChallenges(savedUserId);
      loadMealGifts(savedUserId);
    }
    loadAllBadges();
    loadAvailableChallenges();
    loadWalletStatus();
  }, []);

  async function loadWalletStatus() {
    try {
      const response = await fetch(`${BASE}/wallet/status`);
      const data = await response.json();
      setWalletStatus({
        apple: data.apple?.configured || false,
        google: data.google?.configured || false,
      });
    } catch (error) {
      console.error("Failed to load wallet status:", error);
    }
  }

  function handleAddToAppleWallet() {
    if (!userId) return;
    // Open the wallet pass endpoint - browser will handle the download
    window.open(`${BASE}/users/${userId}/wallet/apple`, "_blank");
  }

  function handleAddToGoogleWallet() {
    if (!userId) return;
    // For now, show demo data (until Google Wallet is configured)
    window.open(`${BASE}/users/${userId}/wallet/google`, "_blank");
  }

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

      // Set GA4 user properties for segmentation
      setUserProperties({
        membershipTier: data.membershipTier,
        lifetimeOrderCount: data.lifetimeOrderCount,
        lifetimeSpent: data.lifetimeSpentCents / 100,
      });

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

  async function loadMealGifts(uid: string) {
    try {
      const response = await fetch(`${BASE}/users/${uid}/meal-gifts`);
      const data = await response.json();
      setMealGifts(data);
    } catch (error) {
      console.error("Failed to load meal gifts:", error);
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

  async function enrollInChallenge(challenge: Challenge) {
    if (!userId) return;
    try {
      const response = await fetch(`${BASE}/users/${userId}/challenges/${challenge.id}/enroll`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success(t("challengeEnrolled"));
        loadUserChallenges(userId);
        
        // Navigate to challenge page for "Meal for a Stranger"
        if (challenge.slug === "meal-for-stranger") {
          router.push(`/${locale}/challenges/meal-for-stranger`);
        }
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

  // Tiers data for modal
  const tiers = [
    {
      name: t("tiers.chopstick"),
      tierKey: "CHOPSTICK" as const,
      iconKey: "chopstick" as const,
      color: "#C7A878",
      requirement: t("tiersModal.chopstickRequirement"),
      benefits: [
        t("tiersModal.benefits.referralBonus"),
        t("tiersModal.benefits.cashback1"),
        t("tiersModal.benefits.earlyAccess"),
      ],
    },
    {
      name: t("tiers.noodleMaster"),
      tierKey: "NOODLE_MASTER" as const,
      iconKey: "noodle-master" as const,
      color: "#7C7A67",
      requirement: t("tiersModal.noodleMasterRequirement"),
      benefits: [
        t("tiersModal.benefits.referralBonus"),
        t("tiersModal.benefits.cashback2"),
        t("tiersModal.benefits.prioritySeating"),
        t("tiersModal.benefits.memberEvents"),
        t("tiersModal.benefits.freeBowl"),
      ],
    },
    {
      name: t("tiers.beefBoss"),
      tierKey: "BEEF_BOSS" as const,
      iconKey: "beef-boss" as const,
      color: "#222222",
      requirement: t("tiersModal.beefBossRequirement"),
      benefits: [
        t("tiersModal.benefits.referralBonus"),
        t("tiersModal.benefits.cashback3"),
        t("tiersModal.benefits.topPrioritySeating"),
        t("tiersModal.benefits.freePremiumBowl"),
        t("tiersModal.benefits.merchDrops"),
        t("tiersModal.benefits.premiumAddons"),
        t("tiersModal.benefits.vipGift"),
        t("tiersModal.benefits.wallOfFame"),
      ],
    },
  ];

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
            overflow: "hidden",
            marginBottom: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          {/* Tier Header with gradient background */}
          <div
            style={{
              backgroundImage: `linear-gradient(145deg, ${
                profile.membershipTier === "CHOPSTICK"
                  ? `${tierColor} 0%, #B8956A 50%, ${tierColor}ee 100%`
                  : profile.membershipTier === "NOODLE_MASTER"
                  ? `#8A8875 0%, ${tierColor} 50%, #6A6855 100%`
                  : `#333333 0%, ${tierColor} 50%, #111111 100%`
              })`,
              padding: "24px",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: profile.membershipTier === "CHOPSTICK" ? "rgba(34, 34, 34, 0.7)" : "rgba(255, 255, 255, 0.8)",
                    marginBottom: 4,
                  }}
                >
                  {t("currentMemberTier")}
                </div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: "bold",
                    color: profile.membershipTier === "CHOPSTICK" ? "#222222" : "#E5E5E5",
                  }}
              >
                {getTierName(profile.membershipTier)}
              </div>
            </div>
              <div
                style={{
                  background: profile.membershipTier === "CHOPSTICK"
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(255, 255, 255, 0.12)",
                  borderRadius: "50%",
                  padding: "16px",
                  boxShadow: profile.membershipTier === "CHOPSTICK"
                    ? "0 6px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.3)"
                    : "0 6px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                  border: profile.membershipTier === "CHOPSTICK"
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TierIcon
                  tier={profile.membershipTier}
                  size={52}
                  invert={profile.membershipTier === "NOODLE_MASTER" || profile.membershipTier === "BEEF_BOSS"}
                />
              </div>
            </div>
          </div>

          {/* Tier Content */}
          <div style={{ padding: 24 }}>
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

            {/* View All Tiers Link */}
            <button
              onClick={() => setShowTiersModal(true)}
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                border: `1px solid ${tierColor}`,
                borderRadius: 8,
                color: tierColor,
                fontSize: "0.9rem",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: profile.nextTier ? 16 : 0,
              }}
            >
              {t("viewAllTiers")}
            </button>
          </div>
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
            <div style={{ fontSize: "0.85rem", color: "#666" }}>{t("availableCredit")}</div>
          </div>
        </div>

        {/* Add to Wallet Section */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 12, fontSize: "1rem" }}>
            {t("addToWallet")}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
            {t("walletDescription")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Apple Wallet Button */}
            <button
              onClick={handleAddToAppleWallet}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                background: "#000",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              {t("addToAppleWallet")}
            </button>

            {/* Google Wallet Button */}
            <button
              onClick={handleAddToGoogleWallet}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                background: "#fff",
                color: "#000",
                border: "1px solid #dadce0",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("addToGoogleWallet")}
            </button>
          </div>
          {!walletStatus?.apple && !walletStatus?.google && (
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: 12, fontStyle: "italic" }}>
              {t("walletComingSoon")}
            </div>
          )}
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
                              {uc.challenge.slug === "meal-for-stranger" && (
                                <button
                                  onClick={() => router.push(`/${locale}/challenges/meal-for-stranger`)}
                                  style={{
                                    marginTop: 8,
                                    width: "100%",
                                    padding: "8px 12px",
                                    background: tierColor,
                                    color: "white",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  🎁 {tMealGift("dashboard.giveAMeal")}
                                </button>
                              )}
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
                          {/* Gift Another Meal button for completed/claimed meal-for-stranger */}
                          {uc.challenge.slug === "meal-for-stranger" && uc.rewardClaimed && (
                            <button
                              onClick={() => router.push(`/${locale}/challenges/meal-for-stranger`)}
                              style={{
                                marginTop: 8,
                                width: "100%",
                                padding: "8px 12px",
                                background: tierColor,
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                              }}
                            >
                              🎁 {tMealGift("dashboard.giftAnotherMeal")}
                            </button>
                          )}
                          {/* Gift history for meal-for-stranger challenge */}
                          {uc.challenge.slug === "meal-for-stranger" && mealGifts.given.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 8, fontWeight: "600" }}>
                                {tMealGift("dashboard.yourGiftHistory")}
                              </div>
                              <div style={{ display: "grid", gap: 8 }}>
                                {mealGifts.given.map((gift) => (
                                  <div
                                    key={gift.id}
                                    style={{
                                      padding: 10,
                                      background: gift.status === "ACCEPTED" ? "rgba(34, 197, 94, 0.1)" : gift.status === "EXPIRED" ? "rgba(239, 68, 68, 0.05)" : "rgba(251, 191, 36, 0.1)",
                                      borderRadius: 8,
                                      border: gift.status === "ACCEPTED" ? "1px solid rgba(34, 197, 94, 0.3)" : gift.status === "EXPIRED" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(251, 191, 36, 0.3)",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                      <span style={{ fontWeight: "600", fontSize: "0.85rem" }}>
                                        ${(gift.amountCents / 100).toFixed(2)} • {gift.location.name}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "2px 6px",
                                          borderRadius: 4,
                                          background: gift.status === "ACCEPTED" ? "#22c55e" : gift.status === "EXPIRED" ? "#ef4444" : "#fbbf24",
                                          color: "white",
                                          fontWeight: "bold",
                                        }}
                                      >
                                        {gift.status}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                                      {gift.status === "ACCEPTED" && gift.acceptedBy
                                        ? tMealGift("dashboard.acceptedBy", { name: gift.acceptedBy.name })
                                        : gift.status === "EXPIRED"
                                        ? tMealGift("dashboard.expired")
                                        : tMealGift("dashboard.pending")}
                                      {" • "}
                                      {new Date(gift.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </div>
                                    {/* Recipient message */}
                                    {gift.status === "ACCEPTED" && gift.chain?.[0]?.messageFromRecipient && (
                                      <div
                                        style={{
                                          marginTop: 6,
                                          padding: "6px 8px",
                                          background: "white",
                                          borderRadius: 6,
                                          borderLeft: "2px solid #22c55e",
                                          fontSize: "0.8rem",
                                          fontStyle: "italic",
                                          color: "#333",
                                        }}
                                      >
                                        &ldquo;{gift.chain[0].messageFromRecipient}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
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
                          onClick={() => enrollInChallenge(challenge)}
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
                  {/* Large check mark for earned badges */}
                  {earned && (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "#7C7A67",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(124, 122, 103, 0.3)",
                      }}
                    >
                      <span
                        style={{
                          color: "white",
                          fontSize: "1.5rem",
                          fontWeight: "bold",
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    </div>
                  )}
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

      {/* Tiers Modal */}
      {showTiersModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowTiersModal(false)}
        >
          <div
            style={{
              background: "#E5E5E5",
              borderRadius: 20,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #ddd",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "#E5E5E5",
                zIndex: 10,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#222" }}>
                {t("tiersModal.title")}
              </h2>
              <button
                onClick={() => setShowTiersModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px 8px",
                }}
              >
                ×
              </button>
            </div>

            {/* Tiers Grid */}
            <div
              style={{
                padding: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 20,
              }}
            >
              {tiers.map((tier) => {
                const isCurrentTier = profile.membershipTier === tier.tierKey;
                const needsInvert = tier.tierKey === "NOODLE_MASTER" || tier.tierKey === "BEEF_BOSS";

                return (
                  <div
                    key={tier.name}
                    style={{
                      background: "white",
                      borderRadius: 16,
                      overflow: "hidden",
                      boxShadow: isCurrentTier
                        ? `0 0 0 3px ${tier.color}, 0 8px 24px rgba(0, 0, 0, 0.15)`
                        : "0 4px 16px rgba(0, 0, 0, 0.1)",
                      transform: isCurrentTier ? "scale(1.02)" : "none",
                      transition: "transform 0.3s ease, box-shadow 0.3s ease",
                      position: "relative",
                    }}
                  >
                    {/* Current Tier Badge */}
                    {isCurrentTier && (
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          background: "white",
                          color: "#222",
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          zIndex: 10,
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: "0.85rem", color: tier.color }}>★</span>
                        {t("tiersModal.yourTier")}
                      </div>
                    )}

                    {/* Tier Header */}
                    <div
                      style={{
                        backgroundImage: `linear-gradient(145deg, ${
                          tier.tierKey === "CHOPSTICK"
                            ? `${tier.color} 0%, #B8956A 50%, ${tier.color}ee 100%`
                            : tier.tierKey === "NOODLE_MASTER"
                            ? `#8A8875 0%, ${tier.color} 50%, #6A6855 100%`
                            : `#333333 0%, ${tier.color} 50%, #111111 100%`
                        })`,
                        padding: "36px 20px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                        <div
                          style={{
                            background: tier.tierKey === "CHOPSTICK"
                              ? "rgba(255, 255, 255, 0.25)"
                              : "rgba(255, 255, 255, 0.12)",
                            borderRadius: "50%",
                            padding: 16,
                            boxShadow: tier.tierKey === "CHOPSTICK"
                              ? "0 4px 16px rgba(0, 0, 0, 0.2)"
                              : "0 4px 16px rgba(0, 0, 0, 0.4)",
                          }}
                        >
                          <TierIcon tier={tier.tierKey} size={64} invert={needsInvert} />
                        </div>
                      </div>
                      <h3
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: "600",
                          marginBottom: 6,
                          color: tier.tierKey === "CHOPSTICK" ? "#222" : "#E5E5E5",
                        }}
                      >
                        {tier.name}
                      </h3>
                      <p
                        style={{
                          fontSize: "0.85rem",
                          opacity: 0.9,
                          color: tier.tierKey === "CHOPSTICK" ? "#222" : "#E5E5E5",
                          margin: 0,
                        }}
                      >
                        {tier.requirement}
                      </p>
                    </div>

                    {/* Tier Benefits */}
                    <div style={{ padding: 20 }}>
                      <h4
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "#666",
                          marginBottom: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {t("tiersModal.benefitsInclude")}
                      </h4>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {tier.benefits.map((benefit, idx) => (
                          <li
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              marginBottom: 10,
                              fontSize: "0.9rem",
                              color: "#222",
                            }}
                          >
                            <span style={{ color: tier.color, flexShrink: 0 }}>✓</span>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
