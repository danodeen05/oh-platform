"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type MealGift = {
  id: string;
  amountCents: number;
  messageFromGiver: string | null;
  payForwardCount: number;
  giver: {
    name: string;
  };
  location: {
    name: string;
    city: string;
  };
};

type MealGiftModalProps = {
  mealGift: MealGift;
  userId: string;
  orderId?: string;
  onAccept: (giftId: string) => void;
  onPayForward: (giftId: string) => void;
  onClose: () => void;
};

export function MealGiftModal({
  mealGift,
  userId,
  orderId,
  onAccept,
  onPayForward,
  onClose,
}: MealGiftModalProps) {
  const toast = useToast();
  const [action, setAction] = useState<"view" | "accept" | "pay-forward">("view");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const giftAmount = (mealGift.amountCents / 100).toFixed(2);

  async function handleAccept() {
    if (!orderId) {
      toast.error("Please create an order first");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/meal-gifts/${mealGift.id}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          recipientId: userId,
          orderId,
          messageFromRecipient: message || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to accept meal gift");
      }

      toast.success(`You've received a $${giftAmount} meal gift!`);
      onAccept(mealGift.id);
      onClose();
    } catch (error: any) {
      console.error("Failed to accept meal gift:", error);
      toast.error(error.message || "Failed to accept meal gift");
      setSubmitting(false);
    }
  }

  async function handlePayForward() {
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/meal-gifts/${mealGift.id}/pay-forward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          recipientId: userId,
          messageFromRecipient: message || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to pay forward meal gift");
      }

      toast.success("You've paid it forward! The next person will get this gift.");
      onPayForward(mealGift.id);
      onClose();
    } catch (error: any) {
      console.error("Failed to pay forward meal gift:", error);
      toast.error(error.message || "Failed to pay forward meal gift");
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          maxWidth: 500,
          width: "100%",
          padding: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {action === "view" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "4rem", marginBottom: 8 }}>🎁</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: 8 }}>
                Someone Gifted You a Meal!
              </h2>
              <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#22c55e" }}>
                ${giftAmount}
              </p>
            </div>

            {mealGift.messageFromGiver && (
              <div
                style={{
                  background: "#f9fafb",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 24,
                  fontStyle: "italic",
                  color: "#666",
                }}
              >
                &quot;{mealGift.messageFromGiver}&quot;
                <div style={{ marginTop: 8, fontSize: "0.875rem", textAlign: "right" }}>
                  - {mealGift.giver.name}
                </div>
              </div>
            )}

            {mealGift.payForwardCount > 0 && (
              <div style={{ textAlign: "center", marginBottom: 24, color: "#7C7A67" }}>
                <strong>Chain of Kindness: {mealGift.payForwardCount} pay-it-forwards!</strong>
              </div>
            )}

            <div style={{ marginBottom: 24, color: "#666", fontSize: "0.9rem" }}>
              <p style={{ marginBottom: 8 }}>
                A kind stranger has gifted you this meal at {mealGift.location.name}. You can:
              </p>
              <ul style={{ marginLeft: 20 }}>
                <li><strong>Accept it</strong> - Apply to your current order</li>
                <li><strong>Pay it forward</strong> - Pass to the next person</li>
              </ul>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={() => setAction("accept")}
                style={{
                  padding: 16,
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Accept Gift
              </button>
              <button
                onClick={() => setAction("pay-forward")}
                style={{
                  padding: 16,
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Pay It Forward
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: 12,
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                Maybe Later
              </button>
            </div>
          </>
        )}

        {action === "accept" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>✨</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: 8 }}>
                Accept This Gift
              </h2>
              <p style={{ color: "#666" }}>
                The ${giftAmount} will be applied to your order
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
                Thank You Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thank the giver..."
                maxLength={200}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: "1rem",
                  minHeight: 80,
                  resize: "vertical",
                }}
              />
              <div style={{ textAlign: "right", fontSize: "0.875rem", color: "#666" }}>
                {message.length}/200
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={handleAccept}
                disabled={submitting}
                style={{
                  padding: 16,
                  background: submitting ? "#ccc" : "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Processing..." : "Accept Gift"}
              </button>
              <button
                onClick={() => setAction("view")}
                disabled={submitting}
                style={{
                  padding: 12,
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: "1rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Back
              </button>
            </div>
          </>
        )}

        {action === "pay-forward" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>💝</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: 8 }}>
                Pay It Forward
              </h2>
              <p style={{ color: "#666" }}>
                Pass this ${giftAmount} gift to the next diner
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
                Message to Next Person (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add your message of kindness..."
                maxLength={200}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: "1rem",
                  minHeight: 80,
                  resize: "vertical",
                }}
              />
              <div style={{ textAlign: "right", fontSize: "0.875rem", color: "#666" }}>
                {message.length}/200
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={handlePayForward}
                disabled={submitting}
                style={{
                  padding: 16,
                  background: submitting ? "#ccc" : "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Processing..." : "Pay It Forward"}
              </button>
              <button
                onClick={() => setAction("view")}
                disabled={submitting}
                style={{
                  padding: 12,
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: "1rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
