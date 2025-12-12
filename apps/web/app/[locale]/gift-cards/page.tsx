"use client";

import { useState } from "react";
import Link from "next/link";

const giftCardAmounts = [25, 50, 75, 100, 150, 200];

export default function GiftCardsPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");

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
          Gift Cards
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.8",
            fontWeight: "300",
            color: "#C7A878",
          }}
        >
          Share the warmth of the perfect bowl. Send a digital gift card instantly to anyone who deserves a delicious experience.
        </p>
      </section>

      {/* Gift Card Builder */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* Card Preview */}
          <div
            style={{
              background: "linear-gradient(135deg, #7C7A67 0%, #222222 100%)",
              padding: "48px 32px",
              textAlign: "center",
              color: "#E5E5E5",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                fontSize: "0.8rem",
                opacity: 0.7,
                letterSpacing: "2px",
              }}
            >
              DIGITAL GIFT CARD
            </div>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🍜</div>
            <div
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: "300",
                marginBottom: "8px",
              }}
            >
              Oh! Beef Noodle Soup
            </div>
            <div
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                fontWeight: "600",
                color: "#C7A878",
              }}
            >
              ${selectedAmount || customAmount || "0"}
            </div>
          </div>

          {/* Amount Selection */}
          <div style={{ padding: "32px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "20px", color: "#222222" }}>
              Select Amount
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              {giftCardAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                  }}
                  style={{
                    padding: "16px",
                    background: selectedAmount === amount ? "#7C7A67" : "white",
                    color: selectedAmount === amount ? "white" : "#222222",
                    border: `2px solid ${selectedAmount === amount ? "#7C7A67" : "#e5e7eb"}`,
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    transition: "all 0.2s ease",
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ fontSize: "0.9rem", color: "#666", display: "block", marginBottom: "8px" }}>
                Or enter a custom amount ($10 - $500)
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#666",
                    fontSize: "1.1rem",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  placeholder="Enter amount"
                  style={{
                    width: "100%",
                    padding: "16px 16px 16px 32px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Recipient Info */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "20px", color: "#222222" }}>
              Recipient Details
            </h3>

            <div style={{ display: "grid", gap: "16px", marginBottom: "32px" }}>
              <div>
                <label style={{ fontSize: "0.9rem", color: "#666", display: "block", marginBottom: "8px" }}>
                  Recipient&apos;s Email
                </label>
                <input
                  type="email"
                  placeholder="friend@email.com"
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.9rem", color: "#666", display: "block", marginBottom: "8px" }}>
                  Recipient&apos;s Name
                </label>
                <input
                  type="text"
                  placeholder="Their name"
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.9rem", color: "#666", display: "block", marginBottom: "8px" }}>
                  Personal Message (optional)
                </label>
                <textarea
                  placeholder="Add a personal touch..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>
            </div>

            {/* Purchase Button */}
            <button
              style={{
                width: "100%",
                padding: "18px",
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "1.1rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              Purchase Gift Card
            </button>

            <p style={{ textAlign: "center", color: "#666", fontSize: "0.85rem", marginTop: "16px" }}>
              Gift cards are delivered instantly via email
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "white", padding: "80px 24px" }}>
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
            The Perfect Gift
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "40px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                }}
              >
                ⚡
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Instant Delivery
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Delivered directly to their inbox within minutes. Perfect for last-minute gifts.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                }}
              >
                🎁
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Personalized
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Add a custom message to make your gift extra special and memorable.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                }}
              >
                ♾️
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Never Expires
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Our gift cards never expire. Use them whenever you&apos;re ready for the perfect bowl.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background: "rgba(199, 168, 120, 0.15)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "2rem",
                }}
              >
                📱
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "12px", color: "#222222" }}>
                Easy to Redeem
              </h3>
              <p style={{ color: "#666", lineHeight: "1.6" }}>
                Simply apply the gift card code at checkout. Works with all menu items.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate/Bulk Section */}
      <section
        style={{
          background: "#222222",
          color: "#E5E5E5",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "300",
              marginBottom: "16px",
              letterSpacing: "1px",
            }}
          >
            Corporate & Bulk Orders
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              opacity: 0.9,
              marginBottom: "32px",
              lineHeight: "1.7",
            }}
          >
            Perfect for employee appreciation, client gifts, or team celebrations. Get special pricing on bulk gift card purchases.
          </p>
          <Link
            href="/contact"
            style={{
              display: "inline-block",
              padding: "16px 40px",
              background: "#C7A878",
              color: "#222222",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "500",
              transition: "all 0.3s ease",
            }}
          >
            Contact Us
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "40px",
              textAlign: "center",
            }}
          >
            Frequently Asked Questions
          </h2>

          <div style={{ display: "grid", gap: "20px" }}>
            {[
              {
                q: "How are digital gift cards delivered?",
                a: "Gift cards are sent directly to the recipient's email address within minutes of purchase. They'll receive a beautifully designed email with the gift card code and your personal message.",
              },
              {
                q: "Can I use multiple gift cards on one order?",
                a: "Yes! You can combine multiple gift cards on a single order. Any remaining balance stays on your account for future use.",
              },
              {
                q: "What if my gift card is lost or stolen?",
                a: "Contact our support team with your purchase confirmation, and we'll help you recover or replace your gift card.",
              },
              {
                q: "Can I check my gift card balance?",
                a: "Yes, you can check your balance anytime in the 'My Account' section or by contacting our support team.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                  {faq.q}
                </h4>
                <p style={{ color: "#666", lineHeight: "1.6", fontSize: "0.95rem" }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
