"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const CARD_STATUSES = ["ACTIVE", "REDEEMED", "EXHAUSTED", "EXPIRED", "CANCELLED"];

interface ShopOrderUsage {
  id: string;
  orderNumber: string;
  giftCardApplied: number;
  createdAt: string;
}

interface GiftCard {
  id: string;
  code: string;
  amountCents: number;
  balanceCents: number;
  status: string;
  purchaser?: { id: string; email: string; name?: string };
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
  stripePaymentId?: string;
  designId?: string;
  purchasedAt: string;
  expiresAt?: string;
  adminNotes?: string;
  shopOrders: ShopOrderUsage[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: "#d1fae5", text: "#065f46" },
    REDEEMED: { bg: "#e0e7ff", text: "#3730a3" },
    EXHAUSTED: { bg: "#f3f4f6", text: "#374151" },
    EXPIRED: { bg: "#fef3c7", text: "#92400e" },
    CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
  };
  const color = colors[status] || { bg: "#f3f4f6", text: "#374151" };

  return (
    <span style={{
      padding: "4px 12px",
      borderRadius: 4,
      fontSize: "0.85rem",
      fontWeight: 500,
      backgroundColor: color.bg,
      color: color.text,
    }}>
      {status}
    </span>
  );
}

export default function GiftCardDetailPage() {
  const params = useParams();
  const cardId = params.id as string;

  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [status, setStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Balance adjustment
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const fetchCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/gift-cards/${cardId}`);
      if (!res.ok) {
        throw new Error("Gift card not found");
      }
      const data = await res.json();
      setCard(data);
      setStatus(data.status);
      setAdminNotes(data.adminNotes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gift card");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (cardId) {
      fetchCard();
    }
  }, [cardId]);

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/gift-cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            adminNotes: adminNotes || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update");
        }
        fetchCard();
        alert("Gift card updated successfully");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update");
      }
    });
  };

  const handleBalanceAdjust = () => {
    const adjustCents = parseInt(adjustAmount, 10);
    if (isNaN(adjustCents)) {
      alert("Invalid amount");
      return;
    }
    if (!adjustReason.trim()) {
      alert("Please provide a reason for the adjustment");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/gift-cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balanceAdjustment: adjustCents,
            adjustmentReason: adjustReason,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to adjust balance");
        }
        setShowBalanceAdjust(false);
        setAdjustAmount("");
        setAdjustReason("");
        fetchCard();
        alert("Balance adjusted successfully");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to adjust balance");
      }
    });
  };

  const handleDeactivate = () => {
    if (!confirm("Are you sure you want to deactivate this gift card? This will prevent it from being used.")) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/gift-cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to deactivate");
        }
        fetchCard();
        alert("Gift card deactivated");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to deactivate");
      }
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/gift-cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to reactivate");
        }
        fetchCard();
        alert("Gift card reactivated");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to reactivate");
      }
    });
  };

  if (loading) {
    return <main style={{ padding: 24 }}><p>Loading...</p></main>;
  }

  if (error || !card) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#991b1b" }}>{error || "Gift card not found"}</p>
        <Link href="/gift-cards" style={{ color: "#4f46e5" }}>Back to Gift Cards</Link>
      </main>
    );
  }

  const usedAmount = card.amountCents - card.balanceCents;
  const percentUsed = card.amountCents > 0 ? (usedAmount / card.amountCents) * 100 : 0;

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/gift-cards" style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Gift Cards
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "monospace" }}>{card.code}</h2>
            <p style={{ color: "#6b7280", margin: "4px 0 0" }}>
              Purchased {new Date(card.purchasedAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={card.status} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div>
          {/* Balance Overview */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Balance</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Original Amount</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>${(card.amountCents / 100).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Amount Used</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#6b7280" }}>${(usedAmount / 100).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Remaining Balance</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#059669" }}>${(card.balanceCents / 100).toFixed(2)}</div>
              </div>
            </div>
            <div style={{ width: "100%", height: 8, backgroundColor: "#e5e7eb", borderRadius: 4 }}>
              <div style={{ width: `${100 - percentUsed}%`, height: "100%", backgroundColor: "#10b981", borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 4 }}>
              {percentUsed.toFixed(1)}% used
            </div>

            {/* Balance Adjustment */}
            {!showBalanceAdjust ? (
              <button
                onClick={() => setShowBalanceAdjust(true)}
                style={{
                  marginTop: 16,
                  padding: "8px 16px",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Adjust Balance
              </button>
            ) : (
              <div style={{ marginTop: 16, padding: 16, backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <h4 style={{ marginTop: 0 }}>Balance Adjustment</h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}>Amount (in cents, use negative to reduce)</label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g., 500 to add $5, -500 to remove $5"
                    style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}>Reason (required)</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g., Customer service credit, error correction"
                    style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleBalanceAdjust}
                    disabled={pending}
                    style={{ padding: "8px 16px", backgroundColor: "#059669", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                  >
                    {pending ? "Adjusting..." : "Apply Adjustment"}
                  </button>
                  <button
                    onClick={() => { setShowBalanceAdjust(false); setAdjustAmount(""); setAdjustReason(""); }}
                    style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Usage History */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Usage History</h3>
            {card.shopOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>This gift card has not been used yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 8 }}>Order</th>
                    <th style={{ textAlign: "right", padding: 8 }}>Amount</th>
                    <th style={{ textAlign: "right", padding: 8 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {card.shopOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 8 }}>
                        <Link href={`/shop-orders/${order.id}`} style={{ color: "#4f46e5", textDecoration: "none" }}>
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td style={{ textAlign: "right", padding: 8, color: "#991b1b" }}>
                        -${(order.giftCardApplied / 100).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", padding: 8, color: "#6b7280", fontSize: "0.85rem" }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Admin Controls */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Admin Controls</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%", maxWidth: 200, padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              >
                {CARD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={3}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleSave}
                disabled={pending}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: pending ? "not-allowed" : "pointer",
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Saving..." : "Save Changes"}
              </button>

              {card.status === "ACTIVE" && (
                <button
                  onClick={handleDeactivate}
                  disabled={pending}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: pending ? "not-allowed" : "pointer",
                  }}
                >
                  Deactivate Card
                </button>
              )}

              {card.status === "CANCELLED" && (
                <button
                  onClick={handleReactivate}
                  disabled={pending}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: pending ? "not-allowed" : "pointer",
                  }}
                >
                  Reactivate Card
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Purchaser Info */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Purchaser</h3>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 500 }}>{card.purchaser?.name || "Unknown"}</div>
              <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>{card.purchaser?.email || "Guest"}</div>
              {card.purchaser?.id && (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace", marginTop: 4 }}>
                  ID: {card.purchaser.id}
                </div>
              )}
            </div>
          </div>

          {/* Recipient Info */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Recipient</h3>
            {card.recipientEmail ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 500 }}>{card.recipientName || "Unknown"}</div>
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>{card.recipientEmail}</div>
                </div>
                {card.personalMessage && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: "#fff", borderRadius: 4, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Message:</div>
                    <div style={{ fontSize: "0.9rem", fontStyle: "italic" }}>&ldquo;{card.personalMessage}&rdquo;</div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>Purchased for self</p>
            )}
          </div>

          {/* Payment Info */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            {card.stripePaymentId ? (
              <div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Stripe Payment ID:</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>{card.stripePaymentId}</div>
              </div>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>No payment info available</p>
            )}
          </div>

          {/* Card Details */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Details</h3>
            <div style={{ fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#6b7280" }}>Design:</span>
                <span>{card.designId || "Default"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#6b7280" }}>Purchased:</span>
                <span>{new Date(card.purchasedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Expires:</span>
                <span>{card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : "Never"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
