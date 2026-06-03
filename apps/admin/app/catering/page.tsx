"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "../analytics/components/StatCard";
import EventFormModal from "./_components/EventFormModal";
import StatusBadge from "./_components/StatusBadge";
import OrderNowToggle from "./_components/OrderNowToggle";
import BookingCalendar from "./_components/BookingCalendar";
import type { CateringEvent, CateringAnalytics, CateringSlot } from "./_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function CateringPage() {
  const [events, setEvents] = useState<CateringEvent[]>([]);
  const [analytics, setAnalytics] = useState<CateringAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CateringEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);
  const [prefillSlot, setPrefillSlot] = useState<CateringSlot | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/catering/events`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch catering events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${BASE}/admin/catering/analytics`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch catering analytics:", err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchAnalytics();
  }, []);

  const handleCreate = () => {
    setEditingEvent(null);
    setPrefillDate(undefined);
    setPrefillSlot(undefined);
    setModalOpen(true);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = async (event: CateringEvent) => {
    if (
      !window.confirm(
        `Permanently delete "${event.clientCompany}" and ALL related data ` +
          `(booking, RSVPs, orders, survey)? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(event.id);
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      await Promise.all([fetchEvents(), fetchAnalytics()]);
    } catch (err) {
      alert("Failed to delete event: " + (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCalendarCreate = (date: string, slot: CateringSlot) => {
    setEditingEvent(null);
    setPrefillDate(date);
    setPrefillSlot(slot);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setPrefillDate(undefined);
    setPrefillSlot(undefined);
  };

  const handleSuccess = () => {
    fetchEvents();
    fetchAnalytics();
  };

  return (
    <main style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Catering</h2>
        <p style={{ color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
          Manage corporate catering events, bookings, and attendee orders.
        </p>
      </div>

      {/* Site toggle */}
      <div style={{ marginBottom: 20 }}>
        <OrderNowToggle />
      </div>

      {/* Analytics summary */}
      {analytics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard title="Events Created" value={analytics.eventsCreated} color="blue" />
          <StatCard title="Bookings Confirmed" value={analytics.bookingsConfirmed} color="green" />
          <StatCard
            title="Booking Conversion"
            value={`${analytics.bookingConversionPct.toFixed(1)}%`}
            subtitle={`${analytics.bookingsStarted} started`}
            color="yellow"
          />
          <StatCard title="RSVP Count" value={analytics.rsvpCount} subtitle={`${analytics.rsvpPerEvent.toFixed(1)} / event`} />
          <StatCard
            title="Order Conversion"
            value={`${analytics.orderConversionPct.toFixed(1)}%`}
            subtitle={`${analytics.attendeeOrders} orders`}
            color="green"
          />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={handleCreate}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          + Create Event
        </button>
        <button
          onClick={() => setShowCalendar((v) => !v)}
          style={{
            padding: "10px 20px",
            backgroundColor: showCalendar ? "#e0e7ff" : "white",
            color: showCalendar ? "#3730a3" : "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          {showCalendar ? "Hide Calendar" : "Calendar View"}
        </button>
        <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Calendar view */}
      {showCalendar && (
        <div style={{ marginBottom: 24 }}>
          <BookingCalendar onCreateWithPrefill={handleCalendarCreate} />
        </div>
      )}

      {/* Events table */}
      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading...</p>
      ) : (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Company
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Event Name
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Date
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Slot
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Status
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Bowls Booked
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 600, color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}
                  >
                    No catering events yet. Create your first one!
                  </td>
                </tr>
              ) : (
                events.map((event, i) => (
                  <tr
                    key={event.id}
                    style={{
                      borderBottom: i < events.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 500 }}>{event.clientCompany}</div>
                      {event.contactName && (
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{event.contactName}</div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#374151" }}>
                      {event.eventName || <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>
                      {new Date(event.eventDate).toLocaleDateString("en-US", {
                        timeZone: "America/Denver",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          backgroundColor: event.slot === "LUNCH" ? "#fef3c7" : "#e0e7ff",
                          color: event.slot === "LUNCH" ? "#92400e" : "#3730a3",
                        }}
                      >
                        {event.slot}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <StatusBadge status={event.status} />
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 500 }}>
                      {event.bookedBowls > 0 ? (
                        <span style={{ color: "#059669" }}>{event.bookedBowls}</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>0</span>
                      )}
                      <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                        {" "}/ {event.minimumBowls} min
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link
                        href={`/catering/${event.id}`}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          borderRadius: 4,
                          textDecoration: "none",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          marginRight: 8,
                        }}
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(event)}
                        disabled={deletingId === event.id}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fef2f2",
                          color: "#b91c1c",
                          border: "1px solid #fecaca",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          cursor: deletingId === event.id ? "default" : "pointer",
                          opacity: deletingId === event.id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === event.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <EventFormModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editingEvent={editingEvent}
        prefillDate={prefillDate}
        prefillSlot={prefillSlot}
      />
    </main>
  );
}
