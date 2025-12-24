"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function GroupJoinBanner() {
  const router = useRouter();
  const t = useTranslations("order.groupBanner");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoinGroup() {
    if (!groupCode.trim()) {
      setError(t("enterGroupCode"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Navigate to the group join page
      router.push(`/group/${groupCode.trim().toUpperCase()}`);
    } catch (e) {
      setError(t("failedToJoin"));
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 24,
        padding: "12px 16px",
        background: "rgba(255, 255, 255, 0.5)",
        borderRadius: 2,
        border: "1px solid rgba(124, 122, 103, 0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: "0.85rem", color: "#222222" }}>
            <span style={{ fontWeight: 500 }}>{t("diningTogether")}</span>
            <span style={{ color: "#666666", marginLeft: 8 }}>{t("startOrJoin")}</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!showJoinInput ? (
            <>
              <button
                onClick={() => router.push("/order?group=true")}
                style={{
                  padding: "6px 14px",
                  background: "#7C7A67",
                  color: "#E5E5E5",
                  border: "none",
                  borderRadius: 2,
                  fontWeight: 400,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  letterSpacing: "0.5px",
                }}
              >
                {t("startGroupOrder")}
              </button>
              <button
                onClick={() => setShowJoinInput(true)}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  color: "#222222",
                  border: "1px solid rgba(124, 122, 103, 0.15)",
                  borderRadius: 2,
                  fontWeight: 400,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  letterSpacing: "0.5px",
                }}
              >
                {t("joinGroup")}
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder={t("enterCode")}
                value={groupCode}
                onChange={(e) => {
                  setGroupCode(e.target.value.toUpperCase());
                  setError("");
                }}
                maxLength={6}
                style={{
                  padding: "6px 12px",
                  border: error ? "1px solid #ef4444" : "1px solid rgba(124, 122, 103, 0.15)",
                  borderRadius: 2,
                  fontSize: "0.85rem",
                  width: 120,
                  textTransform: "uppercase",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  background: "rgba(255, 255, 255, 0.8)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinGroup();
                }}
                autoFocus
              />
              <button
                onClick={handleJoinGroup}
                disabled={loading}
                style={{
                  padding: "6px 14px",
                  background: "#222222",
                  color: "#E5E5E5",
                  border: "none",
                  borderRadius: 2,
                  fontWeight: 400,
                  cursor: loading ? "wait" : "pointer",
                  fontSize: "0.8rem",
                }}
              >
                {loading ? "..." : t("join")}
              </button>
              <button
                onClick={() => {
                  setShowJoinInput(false);
                  setGroupCode("");
                  setError("");
                }}
                style={{
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#666666",
                  fontSize: "1rem",
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 6, color: "#ef4444", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
