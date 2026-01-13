"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const FULFILLMENT_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const FULFILLMENT_TYPES = ["SHIPPING", "IN_STORE_PICKUP"];

interface ShopOrderItem {
  id: string;
  quantity: number;
  priceCents: number;
  product: {
    name: string;
  };
}

interface ShopOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentType: string;
  trackingNumber?: string;
  createdAt: string;
  items: ShopOrderItem[];
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
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
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: "0.75rem",
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
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: "0.75rem",
      fontWeight: 500,
      backgroundColor: color.bg,
      color: color.text,
    }}>
      {status}
    </span>
  );
}

function OrderRow({ order }: { order: ShopOrder }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemSummary = order.items.length > 0
    ? order.items.map(i => `${i.quantity}x ${i.product.name}`).join(", ")
    : "No items";

  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12 }}>
        <Link href={`/shop-orders/${order.id}`} style={{ color: "#4f46e5", fontWeight: 500, textDecoration: "none" }}>
          {order.orderNumber}
        </Link>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          {new Date(order.createdAt).toLocaleDateString()}
        </div>
      </td>
      <td style={{ padding: 12 }}>
        <div>{order.customerName || "Guest"}</div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{order.customerEmail}</div>
      </td>
      <td style={{ padding: 12 }}>
        <div style={{ fontSize: "0.85rem" }} title={itemSummary}>
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {itemSummary}
        </div>
      </td>
      <td style={{ padding: 12, fontWeight: 500 }}>
        ${(order.totalCents / 100).toFixed(2)}
      </td>
      <td style={{ padding: 12 }}>
        <PaymentStatusBadge status={order.paymentStatus} />
      </td>
      <td style={{ padding: 12 }}>
        <FulfillmentStatusBadge status={order.fulfillmentStatus} />
        {order.trackingNumber && (
          <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: 2 }}>
            {order.trackingNumber}
          </div>
        )}
      </td>
      <td style={{ padding: 12 }}>
        <span style={{
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: "0.7rem",
          backgroundColor: order.fulfillmentType === "SHIPPING" ? "#dbeafe" : "#fef3c7",
          color: order.fulfillmentType === "SHIPPING" ? "#1e40af" : "#92400e",
        }}>
          {order.fulfillmentType === "SHIPPING" ? "Ship" : "Pickup"}
        </span>
      </td>
      <td style={{ padding: 12 }}>
        <Link
          href={`/shop-orders/${order.id}`}
          style={{
            padding: "4px 8px",
            fontSize: "0.8rem",
            backgroundColor: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            textDecoration: "none",
            color: "#374151",
          }}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

export default function ShopOrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalOrders: number; pendingFulfillment: number; todayOrders: number; totalRevenue: number } | null>(null);

  // Filters
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
      if (fulfillmentType) params.set("fulfillmentType", fulfillmentType);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${BASE}/admin/shop/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BASE}/admin/shop/orders/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchOrders(1);
    fetchStats();
  }, [paymentStatus, fulfillmentStatus, fulfillmentType, startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const clearFilters = () => {
    setPaymentStatus("");
    setFulfillmentStatus("");
    setFulfillmentType("");
    setSearch("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <main style={{ padding: 24 }}>
      <h2>Shop Orders</h2>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Manage e-commerce orders, fulfillment, and shipping.</p>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total Orders</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.totalOrders}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d" }}>
            <div style={{ fontSize: "0.8rem", color: "#92400e" }}>Pending Fulfillment</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#92400e" }}>{stats.pendingFulfillment}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#dbeafe", borderRadius: 8, border: "1px solid #93c5fd" }}>
            <div style={{ fontSize: "0.8rem", color: "#1e40af" }}>Today&apos;s Orders</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1e40af" }}>{stats.todayOrders}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#d1fae5", borderRadius: 8, border: "1px solid #6ee7b7" }}>
            <div style={{ fontSize: "0.8rem", color: "#065f46" }}>Total Revenue</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#065f46" }}>${(stats.totalRevenue / 100).toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, marginBottom: 16, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Payment Status</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}>
              <option value="">All</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Fulfillment Status</label>
            <select value={fulfillmentStatus} onChange={(e) => setFulfillmentStatus(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}>
              <option value="">All</option>
              {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Fulfillment Type</label>
            <select value={fulfillmentType} onChange={(e) => setFulfillmentType(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}>
              <option value="">All</option>
              {FULFILLMENT_TYPES.map((s) => <option key={s} value={s}>{s === "SHIPPING" ? "Shipping" : "In-Store Pickup"}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }} />
          </div>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, email, name..."
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db", width: 180 }}
              />
            </div>
            <button type="submit" style={{ alignSelf: "flex-end", padding: "8px 12px", backgroundColor: "#4f46e5", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
              Search
            </button>
          </form>
          <button onClick={clearFilters} style={{ alignSelf: "flex-end", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", backgroundColor: "white" }}>
            Clear
          </button>
        </div>
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 8, fontSize: "0.9rem", color: "#6b7280" }}>
        Showing {orders.length} of {pagination.totalCount} orders
      </div>

      {/* Orders Table */}
      {loading ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No orders found.</p>
      ) : (
        <>
          <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "0.9rem", width: "100%" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Order #</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Customer</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Items</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Total</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Payment</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Fulfillment</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Type</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <button
                onClick={() => fetchOrders(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 4, cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchOrders(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 4, cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
