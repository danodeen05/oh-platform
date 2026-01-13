"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const CARD_STATUSES = ["ACTIVE", "REDEEMED", "EXHAUSTED", "EXPIRED", "CANCELLED"];

interface GiftCard {
  id: string;
  code: string;
  amountCents: number;
  balanceCents: number;
  status: string;
  purchaser?: { email: string; name?: string };
  recipientEmail?: string;
  recipientName?: string;
  purchasedAt: string;
  expiresAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface Stats {
  totalCards: number;
  byStatus: { active: number; redeemed: number; exhausted: number };
  totalSoldCents: number;
  outstandingBalanceCents: number;
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

function BalanceDisplay({ original, remaining }: { original: number; remaining: number }) {
  const percentUsed = original > 0 ? ((original - remaining) / original) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
        <span style={{ fontWeight: 500 }}>${(remaining / 100).toFixed(2)}</span>
        {remaining !== original && (
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>/ ${(original / 100).toFixed(2)}</span>
        )}
      </div>
      {remaining !== original && (
        <div style={{ width: 60, height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, marginTop: 4 }}>
          <div style={{ width: `${100 - percentUsed}%`, height: "100%", backgroundColor: "#10b981", borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

function GiftCardRow({ card }: { card: GiftCard }) {
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12 }}>
        <Link href={`/gift-cards/${card.id}`} style={{ color: "#4f46e5", fontWeight: 500, textDecoration: "none", fontFamily: "monospace" }}>
          {card.code}
        </Link>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          {new Date(card.purchasedAt).toLocaleDateString()}
        </div>
      </td>
      <td style={{ padding: 12 }}>
        <BalanceDisplay original={card.amountCents} remaining={card.balanceCents} />
      </td>
      <td style={{ padding: 12 }}>
        <StatusBadge status={card.status} />
      </td>
      <td style={{ padding: 12 }}>
        <div>{card.purchaser?.name || "—"}</div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{card.purchaser?.email || "Guest"}</div>
      </td>
      <td style={{ padding: 12 }}>
        {card.recipientEmail ? (
          <>
            <div>{card.recipientName || "—"}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{card.recipientEmail}</div>
          </>
        ) : (
          <span style={{ color: "#6b7280" }}>Self</span>
        )}
      </td>
      <td style={{ padding: 12 }}>
        {card.expiresAt ? (
          <span style={{ fontSize: "0.85rem", color: new Date(card.expiresAt) < new Date() ? "#991b1b" : "#374151" }}>
            {new Date(card.expiresAt).toLocaleDateString()}
          </span>
        ) : (
          <span style={{ color: "#6b7280" }}>Never</span>
        )}
      </td>
      <td style={{ padding: 12 }}>
        <Link
          href={`/gift-cards/${card.id}`}
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

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  // Filters
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [hasBalance, setHasBalance] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchCards = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (hasBalance) params.set("hasBalance", hasBalance);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${BASE}/admin/gift-cards?${params.toString()}`);
      const data = await res.json();
      setCards(data.giftCards || []);
      setPagination(data.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to fetch gift cards:", err);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BASE}/admin/gift-cards/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchCards(1);
    fetchStats();
  }, [status, hasBalance, startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards(1);
  };

  const clearFilters = () => {
    setStatus("");
    setSearch("");
    setHasBalance("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Gift Cards</h2>
        <Link href="/gift-cards/config" style={{ color: "#4f46e5", textDecoration: "none", fontSize: "0.9rem" }}>
          Configure Denominations & Designs →
        </Link>
      </div>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Manage purchased gift cards, track balances, and process adjustments.</p>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total Cards Sold</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.totalCards}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#d1fae5", borderRadius: 8, border: "1px solid #6ee7b7" }}>
            <div style={{ fontSize: "0.8rem", color: "#065f46" }}>Active Cards</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#065f46" }}>{stats.byStatus?.active ?? 0}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#dbeafe", borderRadius: 8, border: "1px solid #93c5fd" }}>
            <div style={{ fontSize: "0.8rem", color: "#1e40af" }}>Total Value Sold</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1e40af" }}>${(stats.totalSoldCents / 100).toFixed(2)}</div>
          </div>
          <div style={{ padding: 16, backgroundColor: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d" }}>
            <div style={{ fontSize: "0.8rem", color: "#92400e" }}>Outstanding Balance</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#92400e" }}>${(stats.outstandingBalanceCents / 100).toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, marginBottom: 16, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}>
              <option value="">All</option>
              {CARD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: 4 }}>Balance</label>
            <select value={hasBalance} onChange={(e) => setHasBalance(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}>
              <option value="">All</option>
              <option value="true">Has Balance</option>
              <option value="false">Exhausted</option>
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
                placeholder="Code or email..."
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db", width: 160 }}
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
        Showing {cards.length} of {pagination.totalCount} gift cards
      </div>

      {/* Gift Cards Table */}
      {loading ? (
        <p>Loading...</p>
      ) : cards.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No gift cards found.</p>
      ) : (
        <>
          <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "0.9rem", width: "100%" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Code</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Balance</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Status</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Purchaser</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Recipient</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Expires</th>
                <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <GiftCardRow key={card.id} card={card} />
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <button
                onClick={() => fetchCards(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 4, cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchCards(pagination.page + 1)}
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
