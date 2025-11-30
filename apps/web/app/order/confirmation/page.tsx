"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get("orderNumber");
  const total = searchParams.get("total");
  const paid = searchParams.get("paid");
  const [copied, setCopied] = useState(false);
  const [shareText, setShareText] = useState("");

  useEffect(() => {
    // Get user's referral code from localStorage
    const userId = localStorage.getItem("userId");
    const referralCode = localStorage.getItem("referralCode");

    // Build share text
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const referralUrl = referralCode
      ? `${baseUrl}/order?ref=${referralCode}`
      : baseUrl;

    const text = `Just ordered from Oh! Beef Noodle Soup 🍜🔥 Order #${orderNumber}\n\nBest beef noodles in town! Try it yourself (and get $5 off): ${referralUrl}`;
    setShareText(text);
  }, [orderNumber]);

  function handleShare(platform: string) {
    const encoded = encodeURIComponent(shareText);
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    let url = "";

    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encoded}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          baseUrl
        )}&quote=${encoded}`;
        break;
      case "linkedin":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          baseUrl
        )}`;
        break;
      case "copy":
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);

        // Award share badge (we'll implement this properly later)
        const userId = localStorage.getItem("userId");
        if (userId) {
          // TODO: Call API to award "first share" badge
          console.log("User shared their order! Award badge.");
        }
        return;
      default:
        return;
    }

    if (url) {
      window.open(url, "_blank", "width=600,height=400");

      // Award share badge
      const userId = localStorage.getItem("userId");
      if (userId) {
        // TODO: Call API to award "first share" badge
        console.log("User shared their order! Award badge.");
      }
    }
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator
        .share({
          title: "Oh! Beef Noodle Soup",
          text: shareText,
          url: window.location.origin,
        })
        .then(() => console.log("Shared successfully"))
        .catch((error) => console.log("Error sharing:", error));
    } else {
      // Fallback to copy
      handleShare("copy");
    }
  }

  const totalAmount = total ? (parseInt(total) / 100).toFixed(2) : "0.00";
  const isPaid = paid === "true";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}
      >
        {/* Success Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: isPaid ? "#d1fae5" : "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "2.5rem",
          }}
        >
          {isPaid ? "✓" : "⏳"}
        </div>

        <h1
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: "1.8rem",
            color: "#111",
          }}
        >
          {isPaid ? "Order Confirmed!" : "Order Placed"}
        </h1>

        <p
          style={{
            color: "#666",
            marginBottom: 24,
            fontSize: "1rem",
          }}
        >
          {isPaid
            ? "Payment processed successfully"
            : "Waiting for payment confirmation"}
        </p>

        {/* Order Details */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#666" }}>Order Number</span>
            <strong>#{orderNumber}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "#666" }}>Total</span>
            <strong style={{ fontSize: "1.2rem", color: "#22c55e" }}>
              ${totalAmount}
            </strong>
          </div>
        </div>

        {/* Social Sharing Section */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea20 0%, #764ba220 100%)",
            border: "2px solid #667eea",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🎉</div>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: "1.1rem" }}>
            Share Your Order!
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#666",
              marginBottom: 16,
              margin: 0,
            }}
          >
            Spread the word and earn rewards
          </p>

          {/* Share Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => handleShare("twitter")}
              style={{
                padding: 12,
                background: "#1DA1F2",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>𝕏</span>
              Twitter
            </button>

            <button
              onClick={() => handleShare("facebook")}
              style={{
                padding: 12,
                background: "#1877F2",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>f</span>
              Facebook
            </button>

            <button
              onClick={() => handleShare("linkedin")}
              style={{
                padding: 12,
                background: "#0A66C2",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>in</span>
              LinkedIn
            </button>

            <button
              onClick={() => handleShare("copy")}
              style={{
                padding: 12,
                background: copied ? "#22c55e" : "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.2s",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{copied ? "✓" : "📋"}</span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Native Share Button (Mobile) */}
          {typeof window !== "undefined" &&
            typeof navigator !== "undefined" &&
            navigator.share && (
              <button
                onClick={handleNativeShare}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>📤</span>
                Share via...
              </button>
            )}

          <p
            style={{
              fontSize: "0.75rem",
              color: "#666",
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            💡 Your referral link is included! Friends get $5 off.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gap: 12 }}>
          <button
            onClick={() => router.push("/member")}
            style={{
              width: "100%",
              padding: 14,
              background: "#667eea",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            View My Profile
          </button>

          <button
            onClick={() => router.push("/order")}
            style={{
              width: "100%",
              padding: 14,
              background: "white",
              color: "#667eea",
              border: "2px solid #667eea",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Order Again
          </button>

          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: 14,
              background: "transparent",
              color: "#666",
              border: "none",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <div style={{ color: "white", fontSize: "1.2rem" }}>Loading...</div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
