"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GroupJoinBanner() {
  const router = useRouter();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoinGroup() {
    if (!groupCode.trim()) {
      setError("Please enter a group code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Navigate to the group join page
      router.push(`/group/${groupCode.trim().toUpperCase()}`);
    } catch (e) {
      setError("Failed to join group. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 32,
        padding: 20,
        background: "linear-gradient(135deg, #fef3e2 0%, #fde7cf 100%)",
        borderRadius: 12,
        border: "1px solid #f9a825",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.5rem" }}>👥</span>
          <div>
            <div style={{ fontWeight: 600, color: "#92400e" }}>Dining Together?</div>
            <div style={{ fontSize: "0.9rem", color: "#b45309" }}>
              Start a group order or join an existing one
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!showJoinInput ? (
            <>
              <button
                onClick={() => router.push("/order?group=true")}
                style={{
                  padding: "10px 20px",
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Start Group Order
              </button>
              <button
                onClick={() => setShowJoinInput(true)}
                style={{
                  padding: "10px 20px",
                  background: "white",
                  color: "#7C7A67",
                  border: "2px solid #7C7A67",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Join Group
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Enter code (e.g., ABC123)"
                value={groupCode}
                onChange={(e) => {
                  setGroupCode(e.target.value.toUpperCase());
                  setError("");
                }}
                maxLength={6}
                style={{
                  padding: "10px 16px",
                  border: error ? "2px solid #ef4444" : "2px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: "1rem",
                  width: 160,
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
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
                  padding: "10px 20px",
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {loading ? "..." : "Join"}
              </button>
              <button
                onClick={() => {
                  setShowJoinInput(false);
                  setGroupCode("");
                  setError("");
                }}
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#666",
                  fontSize: "1.2rem",
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 8, color: "#ef4444", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
