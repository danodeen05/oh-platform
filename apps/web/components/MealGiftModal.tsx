"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  onAccept: (giftId: string, message?: string) => void;
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
  const t = useTranslations("mealGift");
  const toast = useToast();
  const [action, setAction] = useState<"view" | "accept" | "pay-forward">("view");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const giftAmount = (mealGift.amountCents / 100).toFixed(2);

  async function handleAccept() {
    // Note: We don't require orderId here because the actual API call to accept
    // the gift happens at checkout time when the order exists. This function
    // just signals the intent to accept the gift and passes the message.
    toast.success(t("toast.reserved", { amount: giftAmount }));
    onAccept(mealGift.id, message || undefined);
    onClose();
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
        throw new Error(t("toast.payForwardFailed"));
      }

      toast.success(t("toast.paidForward"));
      onPayForward(mealGift.id);
      onClose();
    } catch (error: any) {
      console.error("Failed to pay forward meal gift:", error);
      toast.error(error.message || t("toast.payForwardFailed"));
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
                {t("modal.title")}
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
                <strong>{t("modal.chainOfKindness", { count: mealGift.payForwardCount })}</strong>
              </div>
            )}

            <div style={{ marginBottom: 24, color: "#666", fontSize: "0.9rem" }}>
              <p style={{ marginBottom: 8 }}>
                {t("modal.description", { location: mealGift.location.name })}
              </p>
              <ul style={{ marginLeft: 20 }}>
                <li><strong>{t("modal.acceptOption")}</strong> - {t("modal.acceptDescription")}</li>
                <li><strong>{t("modal.forwardOption")}</strong> - {t("modal.forwardDescription")}</li>
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
                {t("modal.acceptButton")}
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
                {t("modal.forwardButton")}
              </button>
            </div>
          </>
        )}

        {action === "accept" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>✨</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: 8 }}>
                {t("modal.acceptTitle")}
              </h2>
              <p style={{ color: "#666" }}>
                {t("modal.acceptSubtitle", { amount: giftAmount })}
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
                {t("modal.thankYouLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("modal.thankYouPlaceholder")}
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
                {submitting ? t("button.processing") : t("modal.acceptButton")}
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
                {t("modal.backButton")}
              </button>
            </div>
          </>
        )}

        {action === "pay-forward" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>💝</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: 8 }}>
                {t("modal.forwardTitle")}
              </h2>
              <p style={{ color: "#666" }}>
                {t("modal.forwardSubtitle", { amount: giftAmount })}
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: 8 }}>
                {t("modal.forwardMessageLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("modal.forwardMessagePlaceholder")}
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
                {submitting ? t("button.processing") : t("modal.forwardButton")}
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
                {t("modal.backButton")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
