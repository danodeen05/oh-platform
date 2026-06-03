"use client";

import { useState, useEffect, useTransition } from "react";
import type { CateringEvent, CateringSlot, CateringEventStatus } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const SLOT_PRICES: Record<CateringSlot, number> = {
  LUNCH: 2499,
  DINNER: 2999,
};

const STATUSES: CateringEventStatus[] = [
  "PLANNING",
  "ENRICHING",
  "NEEDS_REVIEW",
  "LIVE",
  "COMPLETED",
];

type TabKey = "details" | "address" | "pricing" | "branding" | "notes";

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
  eventAddress: string;
  eventLat: string;
  eventLng: string;
  eventDate: string;
  slot: CateringSlot;
  status: CateringEventStatus;
  pricePerBowlCents: string;
  minimumBowls: string;
  bookedBowls: string;
  eventName: string;
  logoUrl: string;
  brandColors: string[];
  companyDescription: string;
  notes: string;
}

const emptyForm = (prefillDate?: string, prefillSlot?: CateringSlot): FormData => ({
  clientCompany: "",
  clientWebsite: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  eventAddress: "",
  eventLat: "",
  eventLng: "",
  eventDate: prefillDate || "",
  slot: prefillSlot || "LUNCH",
  status: "PLANNING",
  pricePerBowlCents: String(SLOT_PRICES[prefillSlot || "LUNCH"]),
  minimumBowls: "10",
  bookedBowls: "0",
  eventName: "",
  logoUrl: "",
  brandColors: [],
  companyDescription: "",
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
  const [activeTab, setActiveTab] = useState<TabKey>("details");
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
        eventAddress: editingEvent.eventAddress || "",
        eventLat: editingEvent.eventLat != null ? String(editingEvent.eventLat) : "",
        eventLng: editingEvent.eventLng != null ? String(editingEvent.eventLng) : "",
        eventDate: editingEvent.eventDate ? editingEvent.eventDate.slice(0, 10) : "",
        slot: editingEvent.slot,
        status: editingEvent.status,
        pricePerBowlCents: String(editingEvent.pricePerBowlCents),
        minimumBowls: String(editingEvent.minimumBowls),
        bookedBowls: String(editingEvent.bookedBowls ?? 0),
        eventName: editingEvent.eventName || "",
        logoUrl: editingEvent.logoUrl || "",
        brandColors: editingEvent.brandColors || [],
        companyDescription: editingEvent.companyDescription || "",
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
    const bookedBowls = parseInt(formData.bookedBowls, 10);

    if (isNaN(pricePerBowlCents) || pricePerBowlCents <= 0) {
      alert("Invalid price per bowl");
      return;
    }
    if (isNaN(minimumBowls) || minimumBowls <= 0) {
      alert("Invalid minimum bowls");
      return;
    }

    const latStr = formData.eventLat.trim();
    const lngStr = formData.eventLng.trim();
    const eventLat = latStr ? parseFloat(latStr) : null;
    const eventLng = lngStr ? parseFloat(lngStr) : null;
    if (latStr && isNaN(eventLat as number)) {
      alert("Invalid latitude");
      return;
    }
    if (lngStr && isNaN(eventLng as number)) {
      alert("Invalid longitude");
      return;
    }

    startTransition(async () => {
      const body: Record<string, unknown> = {
        clientCompany: formData.clientCompany,
        clientWebsite: formData.clientWebsite || undefined,
        contactName: formData.contactName || undefined,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        eventAddress: formData.eventAddress || undefined,
        eventLat: eventLat ?? undefined,
        eventLng: eventLng ?? undefined,
        eventDate: formData.eventDate,
        slot: formData.slot,
        pricePerBowlCents,
        minimumBowls,
        eventName: formData.eventName || undefined,
        logoUrl: formData.logoUrl || undefined,
        brandColors: formData.brandColors.filter(Boolean),
        companyDescription: formData.companyDescription || undefined,
        notes: formData.notes || undefined,
      };

      // Status and booked-bowls overrides only apply to existing events.
      if (editingEvent) {
        body.status = formData.status;
        if (!isNaN(bookedBowls)) body.bookedBowls = bookedBowls;
      }

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

  const tabStyle = (tab: TabKey): React.CSSProperties => ({
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

  // --- Brand color helpers ---
  const addColor = () => field({ brandColors: [...formData.brandColors, "#000000"] });
  const removeColor = (idx: number) =>
    field({ brandColors: formData.brandColors.filter((_, i) => i !== idx) });
  const changeColor = (idx: number, value: string) =>
    field({ brandColors: formData.brandColors.map((c, i) => (i === idx ? value : c)) });

  const tabs: { key: TabKey; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "address", label: "Address" },
    { key: "pricing", label: "Pricing" },
    { key: "branding", label: "Branding" },
    { key: "notes", label: "Notes" },
  ];

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
          {tabs.map((t) => (
            <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
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
                    marginBottom: editingEvent ? 16 : 0,
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

                {editingEvent && (
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => field({ status: e.target.value as CateringEventStatus })}
                      style={inputStyle}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Address Tab */}
            {activeTab === "address" && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Event Address</label>
                  <input
                    placeholder="123 Main St, Salt Lake City, UT 84101"
                    value={formData.eventAddress}
                    onChange={(e) => field({ eventAddress: e.target.value })}
                    style={inputStyle}
                  />
                  <div style={{ marginTop: 4, fontSize: "0.8rem", color: "#6b7280" }}>
                    The full address where the event is catered.
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input
                      placeholder="40.7608"
                      value={formData.eventLat}
                      onChange={(e) => field({ eventLat: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input
                      placeholder="-111.8910"
                      value={formData.eventLng}
                      onChange={(e) => field({ eventLng: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#6b7280" }}>
                  Coordinates are captured automatically at booking. Edit them only if the
                  address was corrected and the map pin needs to move.
                </div>
                {formData.eventLat && formData.eventLng && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${formData.eventLat},${formData.eventLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.8rem", color: "#4f46e5", textDecoration: "none" }}
                    >
                      Preview pin on Google Maps
                    </a>
                  </div>
                )}
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: editingEvent ? "1fr 1fr" : "1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div>
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
                  {editingEvent && (
                    <div>
                      <label style={labelStyle}>Bowls Booked</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.bookedBowls}
                        onChange={(e) => field({ bookedBowls: e.target.value })}
                        style={inputStyle}
                      />
                      <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#9ca3af" }}>
                        Override only. Does not recalculate the existing booking charge.
                      </div>
                    </div>
                  )}
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

            {/* Branding Tab */}
            {activeTab === "branding" && (
              <div>
                <div style={{ marginBottom: 16, fontSize: "0.8rem", color: "#6b7280" }}>
                  These drive the co-branded attendee page. Brand colors map to the page
                  theme (first color = primary accent, second = secondary, third = background
                  tint).
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Event Name (shown to attendees)</label>
                  <input
                    placeholder="e.g., Oh! × Acme Corp"
                    value={formData.eventName}
                    onChange={(e) => field({ eventName: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Logo URL</label>
                  {formData.logoUrl && (
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      style={{
                        height: 56,
                        maxWidth: 200,
                        objectFit: "contain",
                        borderRadius: 4,
                        border: "1px solid #e5e7eb",
                        padding: 4,
                        backgroundColor: "white",
                        marginBottom: 8,
                        display: "block",
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <input
                    placeholder="https://example.com/logo.png"
                    value={formData.logoUrl}
                    onChange={(e) => field({ logoUrl: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Brand Colors</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {formData.brandColors.map((color, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000"}
                          onChange={(e) => changeColor(idx, e.target.value)}
                          style={{
                            width: 40,
                            height: 36,
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            cursor: "pointer",
                            padding: 2,
                          }}
                        />
                        <input
                          value={color}
                          onChange={(e) => changeColor(idx, e.target.value)}
                          style={{
                            width: 84,
                            padding: "4px 6px",
                            fontSize: "0.8rem",
                            fontFamily: "monospace",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeColor(idx)}
                          style={{
                            padding: "2px 6px",
                            fontSize: "0.7rem",
                            border: "1px solid #fca5a5",
                            backgroundColor: "#fee2e2",
                            color: "#991b1b",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addColor}
                      style={{
                        padding: "6px 10px",
                        fontSize: "0.8rem",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        cursor: "pointer",
                        backgroundColor: "white",
                      }}
                    >
                      + Add Color
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Company Description</label>
                  <textarea
                    placeholder="Brief description shown on the attendee landing page..."
                    value={formData.companyDescription}
                    onChange={(e) => field({ companyDescription: e.target.value })}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
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
