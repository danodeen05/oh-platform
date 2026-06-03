"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "../_components/StatusBadge";
import EventFormModal from "../_components/EventFormModal";
import OverviewTab from "./tabs/OverviewTab";
import OrdersTab from "./tabs/OrdersTab";
import ShoppingTab from "./tabs/ShoppingTab";
import OverageTab from "./tabs/OverageTab";
import SurveyTab from "./tabs/SurveyTab";
import type { CateringEvent } from "../_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TabId = "overview" | "orders" | "shopping" | "overage" | "survey";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "shopping", label: "Shopping" },
  { id: "overage", label: "Overage" },
  { id: "survey", label: "Survey" },
];

export default function CateringEventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<CateringEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [invitesSending, setInvitesSending] = useState(false);

  const sendInvites = async () => {
    if (!window.confirm("Text all RSVPs the order link and arrival invite now?")) return;
    setInvitesSending(true);
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}/send-invites`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      alert(`Invites sent to ${data.sent} of ${data.total} RSVP(s)${data.failed ? ` — ${data.failed} failed` : ""}.`);
    } catch (e) {
      alert("Failed to send invites: " + (e as Error).message);
    } finally {
      setInvitesSending(false);
    }
  };
  const [enrichPending, startEnrichTransition] = useTransition();

  const fetchEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}`);
      if (!res.ok) throw new Error("Event not found");
      const data: CateringEvent = await res.json();
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  const handleTriggerEnrich = () => {
    if (!event) return;
    startEnrichTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/catering/events/${eventId}/enrich`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to trigger enrichment");
          return;
        }
        await fetchEvent();
      } catch (err) {
        console.error("Failed to trigger enrichment:", err);
        alert("Failed to trigger enrichment");
      }
    });
  };

  const tabStyle = (tab: TabId): React.CSSProperties => ({
    padding: "10px 20px",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #4f46e5" : "2px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#4f46e5" : "#6b7280",
    fontSize: "0.9rem",
  });

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#991b1b" }}>{error || "Event not found"}</p>
        <Link href="/catering" style={{ color: "#4f46e5" }}>
          &larr; Back to Catering
        </Link>
      </main>
    );
  }

  const formattedDate = new Date(event.eventDate).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/catering" style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.9rem" }}>
          &larr; Back to Catering
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            {event.logoUrl && (
              <img
                src={event.logoUrl}
                alt={`${event.clientCompany} logo`}
                style={{ height: 40, maxWidth: 80, objectFit: "contain" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <h2 style={{ margin: 0 }}>
              {event.eventName || event.clientCompany}
            </h2>
            <StatusBadge status={event.status} />
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            {event.clientCompany}
            {event.eventName && event.eventName !== event.clientCompany && (
              <> &bull; {event.eventName}</>
            )}{" "}
            &bull; {formattedDate} &bull;{" "}
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "0.8rem",
                fontWeight: 500,
                backgroundColor: event.slot === "LUNCH" ? "#fef3c7" : "#e0e7ff",
                color: event.slot === "LUNCH" ? "#92400e" : "#3730a3",
              }}
            >
              {event.slot}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Trigger enrichment if PLANNING and has website */}
          {event.status === "PLANNING" && event.clientWebsite && (
            <button
              onClick={handleTriggerEnrich}
              disabled={enrichPending}
              style={{
                padding: "8px 16px",
                backgroundColor: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: enrichPending ? "not-allowed" : "pointer",
                fontWeight: 500,
                fontSize: "0.85rem",
                opacity: enrichPending ? 0.7 : 1,
              }}
            >
              {enrichPending ? "Enriching..." : "Run AI Enrichment"}
            </button>
          )}
          <button
            onClick={() => setEditModalOpen(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.85rem",
            }}
          >
            Edit Event
          </button>
          <button
            onClick={sendInvites}
            disabled={invitesSending}
            title="Text all RSVPs the order link + 'I've arrived' invite"
            style={{
              padding: "8px 16px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: invitesSending ? "default" : "pointer",
              fontWeight: 500,
              fontSize: "0.85rem",
              opacity: invitesSending ? 0.6 : 1,
            }}
          >
            {invitesSending ? "Sending…" : "Send Invites to RSVPs"}
          </button>
        </div>
      </div>

      {/* Brand color strip */}
      {event.brandColors && event.brandColors.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {event.brandColors.map((color, i) => (
            <div
              key={i}
              title={color}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                backgroundColor: color,
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            />
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          borderBottom: "1px solid #e5e7eb",
          marginBottom: 24,
          display: "flex",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tabStyle(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab event={event} onRefresh={fetchEvent} />
      )}
      {activeTab === "orders" && (
        <OrdersTab eventId={event.id} minimumBowls={event.minimumBowls} />
      )}
      {activeTab === "shopping" && <ShoppingTab eventId={event.id} />}
      {activeTab === "overage" && (
        <OverageTab eventId={event.id} pricePerBowlCents={event.pricePerBowlCents} />
      )}
      {activeTab === "survey" && <SurveyTab eventId={event.id} />}

      {/* Edit modal */}
      <EventFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchEvent}
        editingEvent={event}
      />
    </main>
  );
}
