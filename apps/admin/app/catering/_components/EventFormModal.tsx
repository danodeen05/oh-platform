"use client";

import { useState, useEffect, useTransition } from "react";
import type { CateringEvent, CateringSlot } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const SLOT_PRICES: Record<CateringSlot, number> = {
  LUNCH: 2499,
  DINNER: 2999,
};

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingEvent?: CateringEvent | null;
  prefillDate?: string;
  prefillSlot?: CateringSlot;
}

interface FormData {
  clientCompany: string;
  clientWebsite: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  eventDate: string;
  slot: CateringSlot;
  pricePerBowlCents: string;
  minimumBowls: string;
  notes: string;
}

const emptyForm = (prefillDate?: string, prefillSlot?: CateringSlot): FormData => ({
  clientCompany: "",
  clientWebsite: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  eventDate: prefillDate || "",
  slot: prefillSlot || "LUNCH",
  pricePerBowlCents: String(SLOT_PRICES[prefillSlot || "LUNCH"]),
  minimumBowls: "10",
  notes: "",
});

export default function EventFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingEvent,
  prefillDate,
  prefillSlot,
}: EventFormModalProps) {
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"details" | "pricing" | "notes">("details");
  const [formData, setFormData] = useState<FormData>(emptyForm(prefillDate, prefillSlot));

  useEffect(() => {
    if (!isOpen) return;
    if (editingEvent) {
      setFormData({
        clientCompany: editingEvent.clientCompany,
        clientWebsite: editingEvent.clientWebsite || "",
        contactName: editingEvent.contactName || "",
        contactEmail: editingEvent.contactEmail || "",
        contactPhone: editingEvent.contactPhone || "",
        eventDate: editingEvent.eventDate ? editingEvent.eventDate.slice(0, 10) : "",
        slot: editingEvent.slot,
        pricePerBowlCents: String(editingEvent.pricePerBowlCents),
        minimumBowls: String(editingEvent.minimumBowls),
        notes: editingEvent.notes || "",
      });
    } else {
      setFormData(emptyForm(prefillDate, prefillSlot));
    }
    setActiveTab("details");
  }, [editingEvent, isOpen, prefillDate, prefillSlot]);

  if (!isOpen) return null;

  const handleSlotChange = (slot: CateringSlot) => {
    setFormData((f) => ({
      ...f,
      slot,
      pricePerBowlCents: String(SLOT_PRICES[slot]),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pricePerBowlCents = parseInt(formData.pricePerBowlCents, 10);
    const minimumBowls = parseInt(formData.minimumBowls, 10);

    if (isNaN(pricePerBowlCents) || pricePerBowlCents <= 0) {
      alert("Invalid price per bowl");
      return;
    }
    if (isNaN(minimumBowls) || minimumBowls <= 0) {
      alert("Invalid minimum bowls");
      return;
    }

    startTransition(async () => {
      const body = {
        clientCompany: formData.clientCompany,
        clientWebsite: formData.clientWebsite || undefined,
        contactName: formData.contactName || undefined,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        eventDate: formData.eventDate,
        slot: formData.slot,
        pricePerBowlCents,
        minimumBowls,
        notes: formData.notes || undefined,
      };

      const url = editingEvent
        ? `${BASE}/admin/catering/events/${editingEvent.id}`
        : `${BASE}/admin/catering/events`;
      const method = editingEvent ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to ${editingEvent ? "update" : "create"} event`);
        return;
      }

      const created = await res.json();

      // Trigger AI enrichment if creating with a website
      if (!editingEvent && formData.clientWebsite && created.id) {
        try {
          await fetch(`${BASE}/admin/catering/events/${created.id}/enrich`, {
            method: "POST",
          });
        } catch {
          // Non-fatal; enrichment runs in background
          console.warn("Enrichment trigger failed; proceeding");
        }
      }

      onSuccess();
      onClose();
    });
  };

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #4f46e5" : "2px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#4f46e5" : "#6b7280",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.85rem",
    marginBottom: 4,
    color: "#374151",
  };

  const inputStyle: React.CSSProperties = {
    padding: 8,
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 4,
    border: "1px solid #d1d5db",
  };

  const field = (f: Partial<FormData>) => setFormData((prev) => ({ ...prev, ...f }));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          width: "90%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: 0 }}>
            {editingEvent ? "Edit Catering Event" : "Create Catering Event"}
          </h3>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #e5e7eb" }}>
          <button style={tabStyle("details")} onClick={() => setActiveTab("details")}>
            Details
          </button>
          <button style={tabStyle("pricing")} onClick={() => setActiveTab("pricing")}>
            Pricing
          </button>
          <button style={tabStyle("notes")} onClick={() => setActiveTab("notes")}>
            Notes
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: 16 }}>
            {/* Details Tab */}
            {activeTab === "details" && (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Client Company *</label>
                    <input
                      required
                      placeholder="Acme Corp"
                      value={formData.clientCompany}
                      onChange={(e) => field({ clientCompany: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Website</label>
                    <input
                      placeholder="https://acme.com"
                      value={formData.clientWebsite}
                      onChange={(e) => field({ clientWebsite: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Contact Name</label>
                    <input
                      placeholder="Jane Smith"
                      value={formData.contactName}
                      onChange={(e) => field({ contactName: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Phone</label>
                    <input
                      placeholder="+1 (555) 000-0000"
                      value={formData.contactPhone}
                      onChange={(e) => field({ contactPhone: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Contact Email</label>
                  <input
                    type="email"
                    placeholder="jane@acme.com"
                    value={formData.contactEmail}
                    onChange={(e) => field({ contactEmail: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Event Date *</label>
                    <input
                      required
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) => field({ eventDate: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Slot *</label>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {(["LUNCH", "DINNER"] as CateringSlot[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSlotChange(s)}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            backgroundColor: formData.slot === s ? "#4f46e5" : "white",
                            color: formData.slot === s ? "white" : "#374151",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Tab */}
            {activeTab === "pricing" && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Price Per Bowl (cents) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formData.pricePerBowlCents}
                    onChange={(e) => field({ pricePerBowlCents: e.target.value })}
                    style={inputStyle}
                  />
                  {formData.pricePerBowlCents && !isNaN(parseInt(formData.pricePerBowlCents, 10)) && (
                    <div style={{ marginTop: 4, fontSize: "0.8rem", color: "#6b7280" }}>
                      = ${(parseInt(formData.pricePerBowlCents, 10) / 100).toFixed(2)} per bowl
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Minimum Bowls *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formData.minimumBowls}
                    onChange={(e) => field({ minimumBowls: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {formData.pricePerBowlCents &&
                  formData.minimumBowls &&
                  !isNaN(parseInt(formData.pricePerBowlCents, 10)) &&
                  !isNaN(parseInt(formData.minimumBowls, 10)) && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: "#f0f9ff",
                        borderRadius: 6,
                        border: "1px solid #bae6fd",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong>Minimum commitment:</strong> $
                      {(
                        (parseInt(formData.pricePerBowlCents, 10) *
                          parseInt(formData.minimumBowls, 10)) /
                        100
                      ).toFixed(2)}{" "}
                      ({formData.minimumBowls} bowls x $
                      {(parseInt(formData.pricePerBowlCents, 10) / 100).toFixed(2)})
                    </div>
                  )}

                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    backgroundColor: "#f9fafb",
                    borderRadius: 6,
                    fontSize: "0.8rem",
                    color: "#6b7280",
                  }}
                >
                  Default prices: Lunch = $24.99/bowl, Dinner = $29.99/bowl
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div>
                <label style={labelStyle}>Internal Notes</label>
                <textarea
                  placeholder="Dietary restrictions, special setup requirements, internal context..."
                  value={formData.notes}
                  onChange={(e) => field({ notes: e.target.value })}
                  rows={8}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              padding: 16,
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: "8px 16px",
                backgroundColor: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: pending ? "not-allowed" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending
                ? "Saving..."
                : editingEvent
                ? "Update Event"
                : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
