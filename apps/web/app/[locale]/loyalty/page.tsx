"use client";

import Link from "next/link";

const tiers = [
  {
    name: "Chopstick",
    emoji: "🥢",
    color: "#C7A878",
    requirement: "Sign up",
    benefits: [
      "$5 referral bonus per friend",
      "1% cashback on orders",
      "Early access to new menu items",
    ],
  },
  {
    name: "Noodle Master",
    emoji: "🍜",
    color: "#7C7A67",
    requirement: "10 orders + 5 referrals",
    benefits: [
      "$5 referral bonus per friend",
      "2% cashback on orders",
      "Priority seating",
      "Exclusive member events",
      "Free bowl on tier upgrade",
    ],
  },
  {
    name: "Beef Boss",
    emoji: "🐂",
    color: "#222222",
    requirement: "25 orders + 10 referrals",
    benefits: [
      "$5 referral bonus per friend",
      "3% cashback on orders",
      "Exclusive merchandise drops",
      "Complimentary premium add-ons",
      "Annual VIP Gift & Recognition",
    ],
  },
];

const badges = [
  { emoji: "🌟", name: "First Bowl", description: "Complete your first order" },
  { emoji: "🔥", name: "Hot Streak", description: "Order 3 days in a row" },
  { emoji: "🎯", name: "Perfect Ten", description: "Place 10 orders" },
  { emoji: "💪", name: "Protein Power", description: "Order extra beef 5 times" },
  { emoji: "🌶️", name: "Heat Seeker", description: "Order Inferno spice level" },
  { emoji: "🎁", name: "Gift Giver", description: "Send your first gift card" },
  { emoji: "👥", name: "Community Builder", description: "Refer 5 friends" },
  { emoji: "🏆", name: "Legend", description: "Reach Beef Boss tier" },
];

export default function LoyaltyPage() {
  return (
    <div style={{ background: "#E5E5E5", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(180deg, #222222 0%, #333333 100%)",
          color: "#E5E5E5",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: "300",
            marginBottom: "16px",
            letterSpacing: "2px",
            color: "#E5E5E5",
          }}
        >
          Oh! Rewards
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "650px",
            margin: "0 auto 32px",
            lineHeight: "1.8",
            fontWeight: "300",
            color: "#C7A878",
          }}
        >
          Every bowl brings you closer to something special. Earn credits, unlock badges, and level up your membership with every visit.
        </p>
        <Link
          href="/order"
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#C7A878",
            color: "#222222",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
          }}
        >
          START EARNING
        </Link>
      </section>

      {/* How It Works */}
      <section style={{ padding: "80px 24px", background: "white" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "48px",
              textAlign: "center",
            }}
          >
            How It Works
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "40px",
              maxWidth: "800px",
              margin: "0 auto",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: "#7C7A67",
                    color: "white",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  1
                </span>
                🍜
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Order & Earn
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Every order earns you cashback based on your tier level. Watch your credits grow with each bowl.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: "#7C7A67",
                    color: "white",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  2
                </span>
                👥
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Refer Friends
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Share your unique referral link. When friends order, you both earn credits toward your next meal.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: "#7C7A67",
                    color: "white",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  3
                </span>
                ⬆️
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Level Up
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Unlock higher tiers for better rewards. The more you visit, the more you save.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: "#7C7A67",
                    color: "white",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  4
                </span>
                💸
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Redeem
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Use your credits at checkout. Apply up to $5 per order toward any menu item.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            Membership Tiers
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "48px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto 48px",
            }}
          >
            Start as a Chopstick and work your way to Beef Boss. Every tier unlocks better rewards.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {tiers.map((tier, idx) => (
              <div
                key={tier.name}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                  border: idx === tiers.length - 1 ? `3px solid ${tier.color}` : "none",
                  position: "relative",
                }}
              >
                {idx === tiers.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      background: tier.color,
                      color: "#E5E5E5",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                    }}
                  >
                    ULTIMATE
                  </div>
                )}

                {/* Tier Header */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${tier.color} 0%, ${tier.color}dd 100%)`,
                    padding: "32px 24px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "4rem", marginBottom: "12px" }}>{tier.emoji}</div>
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: tier.name === "Beef Boss" ? "#E5E5E5" : "#222222",
                    }}
                  >
                    {tier.name}
                  </h3>
                  <p style={{ fontSize: "0.9rem", opacity: 0.9, color: tier.name === "Beef Boss" ? "#E5E5E5" : "#222222" }}>
                    {tier.requirement}
                  </p>
                </div>

                {/* Tier Benefits */}
                <div style={{ padding: "24px" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
                    Benefits Include
                  </h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {tier.benefits.map((benefit, benefitIdx) => (
                      <li
                        key={benefitIdx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          marginBottom: "12px",
                          fontSize: "0.95rem",
                          color: "#222222",
                        }}
                      >
                        <span style={{ color: tier.color, flexShrink: 0 }}>✓</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section style={{ background: "#222222", color: "#E5E5E5", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "300",
              marginBottom: "16px",
              textAlign: "center",
              letterSpacing: "1px",
              color: "#E5E5E5",
            }}
          >
            Collect Badges
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              opacity: 0.9,
              marginBottom: "48px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto 48px",
            }}
          >
            Unlock achievements as you dine. Show off your collection and earn bragging rights.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {badges.map((badge) => (
              <div
                key={badge.name}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  padding: "20px",
                  textAlign: "center",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>{badge.emoji}</div>
                <h4 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "8px", color: "#E5E5E5" }}>
                  {badge.name}
                </h4>
                <p style={{ fontSize: "0.85rem", opacity: 0.7, lineHeight: "1.4", color: "#E5E5E5" }}>
                  {badge.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral Section */}
      <section style={{ padding: "80px 24px", background: "white" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "16px",
            }}
          >
            Share the Love, Earn Rewards
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "32px",
              lineHeight: "1.7",
            }}
          >
            Know someone who needs a bowl of comfort? Share your referral link and you&apos;ll both earn credits when they place their first order of $20 or more.
          </p>

          <div
            style={{
              background: "#f9fafb",
              borderRadius: "16px",
              padding: "32px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "24px",
              }}
            >
              <div>
                <div style={{ fontSize: "2.5rem", color: "#7C7A67", fontWeight: "bold" }}>$5</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>for you (Chopstick tier)</div>
              </div>
              <div>
                <div style={{ fontSize: "2.5rem", color: "#7C7A67", fontWeight: "bold" }}>$5</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>for your friend</div>
              </div>
              <div>
                <div style={{ fontSize: "2.5rem", color: "#7C7A67", fontWeight: "bold" }}>♾️</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>unlimited referrals</div>
              </div>
            </div>
          </div>

          <Link
            href="/referral"
            style={{
              display: "inline-block",
              padding: "16px 48px",
              background: "#7C7A67",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Get Your Referral Link
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: "#C7A878",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: "400",
            color: "#222222",
            marginBottom: "16px",
          }}
        >
          Ready to Start Your Journey?
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#222222",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          Sign up now and start earning with your first order.
        </p>
        <Link
          href="/order"
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#222222",
            color: "#E5E5E5",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
          }}
        >
          ORDER NOW
        </Link>
      </section>
    </div>
  );
}
