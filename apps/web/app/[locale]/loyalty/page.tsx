"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { event } from "@/lib/analytics";

export default function LoyaltyPage() {
  const t = useTranslations("loyalty");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const tiers = [
    {
      name: t("tiers.chopstick.name"),
      emoji: "🥢",
      color: "#C7A878",
      requirement: t("tiers.chopstick.requirement"),
      benefits: [
        t("tiers.chopstick.benefits.referralBonus"),
        t("tiers.chopstick.benefits.cashback"),
        t("tiers.chopstick.benefits.earlyAccess"),
      ],
    },
    {
      name: t("tiers.noodleMaster.name"),
      emoji: "🍜",
      color: "#7C7A67",
      requirement: t("tiers.noodleMaster.requirement"),
      benefits: [
        t("tiers.noodleMaster.benefits.referralBonus"),
        t("tiers.noodleMaster.benefits.cashback"),
        t("tiers.noodleMaster.benefits.prioritySeating"),
        t("tiers.noodleMaster.benefits.memberEvents"),
        t("tiers.noodleMaster.benefits.freeBowl"),
      ],
    },
    {
      name: t("tiers.beefBoss.name"),
      emoji: "🐂",
      color: "#222222",
      requirement: t("tiers.beefBoss.requirement"),
      benefits: [
        t("tiers.beefBoss.benefits.referralBonus"),
        t("tiers.beefBoss.benefits.cashback"),
        t("tiers.beefBoss.benefits.merchDrops"),
        t("tiers.beefBoss.benefits.premiumAddons"),
        t("tiers.beefBoss.benefits.vipGift"),
      ],
    },
  ];

  const badges = [
    { emoji: "🌟", name: t("badges.firstBowl.name"), description: t("badges.firstBowl.description") },
    { emoji: "🔥", name: t("badges.hotStreak.name"), description: t("badges.hotStreak.description") },
    { emoji: "🎯", name: t("badges.perfectTen.name"), description: t("badges.perfectTen.description") },
    { emoji: "💪", name: t("badges.proteinPower.name"), description: t("badges.proteinPower.description") },
    { emoji: "🌶️", name: t("badges.heatSeeker.name"), description: t("badges.heatSeeker.description") },
    { emoji: "🎁", name: t("badges.giftGiver.name"), description: t("badges.giftGiver.description") },
    { emoji: "👥", name: t("badges.communityBuilder.name"), description: t("badges.communityBuilder.description") },
    { emoji: "🏆", name: t("badges.legend.name"), description: t("badges.legend.description") },
  ];

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
          {t("title")}
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
          {t("description")}
        </p>
        <Link
          href={`/${locale}/order`}
          onClick={() => {
            event({
              action: "loyalty_cta_click",
              category: "engagement",
              label: "start_earning_hero",
            });
          }}
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
          {tCommon("startEarning")}
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
            {t("howItWorks.title")}
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
                {t("howItWorks.orderEarn.title")}
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                {t("howItWorks.orderEarn.description")}
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
                {t("howItWorks.referFriends.title")}
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                {t("howItWorks.referFriends.description")}
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
                {t("howItWorks.levelUp.title")}
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                {t("howItWorks.levelUp.description")}
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
                {t("howItWorks.redeem.title")}
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                {t("howItWorks.redeem.description")}
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
            {t("tiers.title")}
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
            {t("tiers.description")}
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
                    {t("tiers.ultimate")}
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
                      color: tier.name === t("tiers.beefBoss.name") ? "#E5E5E5" : "#222222",
                    }}
                  >
                    {tier.name}
                  </h3>
                  <p style={{ fontSize: "0.9rem", opacity: 0.9, color: tier.name === t("tiers.beefBoss.name") ? "#E5E5E5" : "#222222" }}>
                    {tier.requirement}
                  </p>
                </div>

                {/* Tier Benefits */}
                <div style={{ padding: "24px" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
                    {t("tiers.benefitsInclude")}
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
            {t("badges.title")}
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
            {t("badges.description")}
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
            {t("referral.title")}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "32px",
              lineHeight: "1.7",
            }}
          >
            {t("referral.description")}
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
                <div style={{ color: "#666", fontSize: "0.9rem" }}>{t("referral.forYou")}</div>
              </div>
              <div>
                <div style={{ fontSize: "2.5rem", color: "#7C7A67", fontWeight: "bold" }}>$5</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>{t("referral.forFriend")}</div>
              </div>
              <div>
                <div style={{ fontSize: "2.5rem", color: "#7C7A67", fontWeight: "bold" }}>♾️</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>{t("referral.unlimited")}</div>
              </div>
            </div>
          </div>

          <Link
            href={`/${locale}/referral`}
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
            {t("referral.getLink")}
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
          {t("cta.title")}
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#222222",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          {t("cta.description")}
        </p>
        <Link
          href={`/${locale}/order`}
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
          {tCommon("orderNow")}
        </Link>
      </section>
    </div>
  );
}
