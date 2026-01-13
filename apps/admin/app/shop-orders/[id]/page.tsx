"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const FULFILLMENT_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];

interface ShopOrderItem {
  id: string;
  quantity: number;
  priceCents: number;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  };
}

interface ShopOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  fulfillmentStatus: string;
  fulfillmentType: string;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCarrier?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  items: ShopOrderItem[];
  promoCode?: {
    code: string;
    discountType: string;
    discountValue: number;
  };
  giftCard?: {
    code: string;
    originalAmountCents: number;
  };
}

function PaymentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "#fef3c7", text: "#92400e" },
    PAID: { bg: "#d1fae5", text: "#065f46" },
    FAILED: { bg: "#fee2e2", text: "#991b1b" },
    REFUNDED: { bg: "#e0e7ff", text: "#3730a3" },
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

function FulfillmentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "#f3f4f6", text: "#374151" },
    PROCESSING: { bg: "#fef3c7", text: "#92400e" },
    SHIPPED: { bg: "#dbeafe", text: "#1e40af" },
    DELIVERED: { bg: "#d1fae5", text: "#065f46" },
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

export default function ShopOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/shop/orders/${orderId}`);
      if (!res.ok) {
        throw new Error("Order not found");
      }
      const data = await res.json();
      setOrder(data);
      setFulfillmentStatus(data.fulfillmentStatus);
      setTrackingNumber(data.trackingNumber || "");
      setTrackingUrl(data.trackingUrl || "");
      setTrackingCarrier(data.trackingCarrier || "");
      setAdminNotes(data.adminNotes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/shop/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fulfillmentStatus,
            trackingNumber: trackingNumber || null,
            trackingUrl: trackingUrl || null,
            trackingCarrier: trackingCarrier || null,
            adminNotes: adminNotes || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update order");
        }
        fetchOrder();
        alert("Order updated successfully");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update");
      }
    });
  };

  const handleMarkShipped = () => {
    if (!trackingNumber) {
      alert("Please enter a tracking number before marking as shipped");
      return;
    }
    setFulfillmentStatus("SHIPPED");
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/shop/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fulfillmentStatus: "SHIPPED",
            trackingNumber,
            trackingUrl: trackingUrl || null,
            trackingCarrier: trackingCarrier || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update order");
        }
        fetchOrder();
        alert("Order marked as shipped");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update");
      }
    });
  };

  if (loading) {
    return <main style={{ padding: 24 }}><p>Loading...</p></main>;
  }

  if (error || !order) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#991b1b" }}>{error || "Order not found"}</p>
        <Link href="/shop-orders" style={{ color: "#4f46e5" }}>Back to Orders</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/shop-orders" style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Orders
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>Order {order.orderNumber}</h2>
            <p style={{ color: "#6b7280", margin: "4px 0 0" }}>
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <PaymentStatusBadge status={order.paymentStatus} />
            <FulfillmentStatusBadge status={order.fulfillmentStatus} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div>
          {/* Order Items */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Order Items</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Product</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Qty</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Price</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.product.imageUrl && (
                          <img src={item.product.imageUrl} alt={item.product.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{item.product.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", padding: 8 }}>{item.quantity}</td>
                    <td style={{ textAlign: "right", padding: 8 }}>${(item.priceCents / 100).toFixed(2)}</td>
                    <td style={{ textAlign: "right", padding: 8, fontWeight: 500 }}>${((item.priceCents * item.quantity) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Order Totals */}
            <div style={{ marginTop: 16, borderTop: "2px solid #e5e7eb", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Subtotal</span>
                <span>${(order.subtotalCents / 100).toFixed(2)}</span>
              </div>
              {order.discountCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: "#059669" }}>
                  <span>Discount {order.promoCode && `(${order.promoCode.code})`}</span>
                  <span>-${(order.discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Shipping</span>
                <span>${(order.shippingCents / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Tax</span>
                <span>${(order.taxCents / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "1.1rem", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                <span>Total</span>
                <span>${(order.totalCents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Fulfillment Controls */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Fulfillment</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Status</label>
                <select
                  value={fulfillmentStatus}
                  onChange={(e) => setFulfillmentStatus(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
                >
                  {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Carrier</label>
                <select
                  value={trackingCarrier}
                  onChange={(e) => setTrackingCarrier(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
                >
                  <option value="">Select carrier...</option>
                  {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number..."
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}>Tracking URL (optional)</label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d1d5db", boxSizing: "border-box" }}
              />
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

            <div style={{ display: "flex", gap: 8 }}>
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
              {order.fulfillmentStatus !== "SHIPPED" && order.fulfillmentStatus !== "DELIVERED" && (
                <button
                  onClick={handleMarkShipped}
                  disabled={pending}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: pending ? "not-allowed" : "pointer",
                    opacity: pending ? 0.7 : 1,
                  }}
                >
                  Mark as Shipped
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Customer Info */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Customer</h3>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 500 }}>{order.customerName || "Guest"}</div>
              <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>{order.customerEmail}</div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.fulfillmentType === "SHIPPING" && (
            <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
              <h3 style={{ marginTop: 0 }}>Shipping Address</h3>
              <div style={{ fontSize: "0.9rem" }}>
                {order.shippingAddress && <div>{order.shippingAddress}</div>}
                {(order.shippingCity || order.shippingState || order.shippingZip) && (
                  <div>{[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(", ")}</div>
                )}
                {order.shippingCountry && <div>{order.shippingCountry}</div>}
              </div>
            </div>
          )}

          {order.fulfillmentType === "IN_STORE_PICKUP" && (
            <div style={{ backgroundColor: "#fef3c7", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #fcd34d" }}>
              <h3 style={{ marginTop: 0, color: "#92400e" }}>In-Store Pickup</h3>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#92400e" }}>Customer will pick up at store</p>
            </div>
          )}

          {/* Payment Info */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            <div style={{ marginBottom: 8 }}>
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            {order.stripePaymentIntentId && (
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 8 }}>
                <div>Stripe Payment ID:</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{order.stripePaymentIntentId}</div>
              </div>
            )}
            {order.giftCard && (
              <div style={{ marginTop: 8, padding: 8, backgroundColor: "#e0e7ff", borderRadius: 4 }}>
                <div style={{ fontSize: "0.8rem", color: "#3730a3" }}>
                  Gift Card: {order.giftCard.code}
                </div>
              </div>
            )}
          </div>

          {/* Tracking Info */}
          {order.trackingNumber && (
            <div style={{ backgroundColor: "#dbeafe", borderRadius: 8, padding: 16, border: "1px solid #93c5fd" }}>
              <h3 style={{ marginTop: 0, color: "#1e40af" }}>Tracking</h3>
              <div style={{ fontSize: "0.9rem" }}>
                {order.trackingCarrier && <div style={{ fontWeight: 500 }}>{order.trackingCarrier}</div>}
                <div style={{ fontFamily: "monospace" }}>{order.trackingNumber}</div>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1e40af", fontSize: "0.85rem" }}
                  >
                    Track Package →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
