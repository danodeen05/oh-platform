"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Pod = {
  id: string;
  number: string;
  qrCode: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  locationId: string;
  row: number;
  col: number;
  side: string;
  podType: "SINGLE" | "DUAL";
  dualPartnerId: string | null;
  dualPartner?: Pod | null;
};

type Location = {
  id: string;
  name: string;
};

export default function PodConfigurator({ locations }: { locations: Location[] }) {
  const [selectedLocation, setSelectedLocation] = useState<string>(locations[0]?.id || "");
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadPods() {
    if (!selectedLocation) return;

    try {
      setLoading(true);
      const response = await fetch(`${BASE}/locations/${selectedLocation}/seats`, {
        headers: { "x-tenant-slug": "oh" },
      });
      const data = await response.json();
      setPods(data);
    } catch (error) {
      console.error("Failed to load pods:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPods();
    setSelectedPods([]);
  }, [selectedLocation]);

  function togglePodSelection(podId: string) {
    setSelectedPods((prev) => {
      if (prev.includes(podId)) {
        return prev.filter((id) => id !== podId);
      }
      // Only allow selecting 2 pods for dual linking
      if (prev.length >= 2) {
        return [prev[1], podId]; // Replace oldest selection
      }
      return [...prev, podId];
    });
  }

  async function linkAsDualPod() {
    if (selectedPods.length !== 2) {
      setMessage({ type: "error", text: "Please select exactly 2 pods to link as a dual pod" });
      return;
    }

    const [pod1Id, pod2Id] = selectedPods;
    const pod1 = pods.find((p) => p.id === pod1Id);
    const pod2 = pods.find((p) => p.id === pod2Id);

    if (!pod1 || !pod2) return;

    // Check if either pod is already linked
    if (pod1.dualPartnerId || pod2.dualPartnerId) {
      setMessage({ type: "error", text: "One or both pods are already linked. Unlink them first." });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${BASE}/seats/link-dual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ seatId1: pod1Id, seatId2: pod2Id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to link pods");
      }

      setMessage({ type: "success", text: `Pods ${pod1.number} and ${pod2.number} are now linked as a dual pod` });
      setSelectedPods([]);
      loadPods();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to link pods" });
    } finally {
      setSaving(false);
    }
  }

  async function unlinkDualPod(podId: string) {
    const pod = pods.find((p) => p.id === podId);
    if (!pod?.dualPartnerId) return;

    try {
      setSaving(true);
      const response = await fetch(`${BASE}/seats/unlink-dual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ seatId: podId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unlink pods");
      }

      setMessage({ type: "success", text: "Dual pod unlinked successfully" });
      setSelectedPods([]);
      loadPods();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to unlink pods" });
    } finally {
      setSaving(false);
    }
  }

  // Group pods by row/side for visual layout
  const podsByPosition = pods.reduce(
    (acc, pod) => {
      const key = `${pod.side}-${pod.row}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pod);
      return acc;
    },
    {} as Record<string, Pod[]>
  );

  // Sort pods within each position by column
  Object.values(podsByPosition).forEach((group) => {
    group.sort((a, b) => a.col - b.col);
  });

  const dualPods = pods.filter((p) => p.podType === "DUAL");
  const singlePods = pods.filter((p) => p.podType === "SINGLE" && !p.dualPartnerId);

  return (
    <div style={{ padding: 24 }}>
      {/* Message Banner */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.25rem",
              color: "inherit",
            }}
          >
            x
          </button>
        </div>
      )}

      {/* Location Selector */}
      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ color: "#6b7280", fontSize: "0.9rem" }}>Location:</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            style={{
              padding: "8px 16px",
              background: "white",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: "1rem",
            }}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0891b2" }}>
                {dualPods.length / 2}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Dual Pods</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#6b7280" }}>
                {singlePods.length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Single Pods</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            <strong>Selected:</strong> {selectedPods.length} pod{selectedPods.length !== 1 ? "s" : ""}
            {selectedPods.length === 2 && (
              <span style={{ marginLeft: 8 }}>
                (Pods {pods.find((p) => p.id === selectedPods[0])?.number} &{" "}
                {pods.find((p) => p.id === selectedPods[1])?.number})
              </span>
            )}
          </div>

          <button
            onClick={linkAsDualPod}
            disabled={selectedPods.length !== 2 || saving}
            style={{
              padding: "10px 20px",
              background: selectedPods.length === 2 ? "#0891b2" : "#e5e7eb",
              color: selectedPods.length === 2 ? "white" : "#9ca3af",
              border: "none",
              borderRadius: 8,
              fontWeight: "600",
              cursor: selectedPods.length === 2 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Link as Dual Pod
          </button>

          <button
            onClick={() => setSelectedPods([])}
            disabled={selectedPods.length === 0}
            style={{
              padding: "10px 20px",
              background: "#f3f4f6",
              color: selectedPods.length > 0 ? "#374151" : "#9ca3af",
              border: "none",
              borderRadius: 8,
              fontWeight: "500",
              cursor: selectedPods.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Clear Selection
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: "0.85rem", color: "#6b7280" }}>
          Click on two adjacent single pods to select them, then click "Link as Dual Pod" to create a dual pod.
          Dual pods can only be assigned to groups of exactly 2 people.
        </p>
      </div>

      {/* Pods Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>Loading pods...</div>
      ) : pods.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          No pods configured for this location
        </div>
      ) : (
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", color: "#374151" }}>Seating Layout</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {pods
              .sort((a, b) => {
                // Sort by number
                return parseInt(a.number) - parseInt(b.number);
              })
              .map((pod) => {
                const isSelected = selectedPods.includes(pod.id);
                const isDual = pod.podType === "DUAL";
                const partnerPod = isDual ? pods.find((p) => p.id === pod.dualPartnerId) : null;

                return (
                  <div
                    key={pod.id}
                    onClick={() => {
                      if (!isDual) {
                        togglePodSelection(pod.id);
                      }
                    }}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      border: isSelected
                        ? "3px solid #3b82f6"
                        : isDual
                          ? "3px solid #22d3ee"
                          : "2px solid #e5e7eb",
                      background: isSelected
                        ? "#eff6ff"
                        : isDual
                          ? "#ecfeff"
                          : "white",
                      cursor: isDual ? "default" : "pointer",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    {/* Dual Badge */}
                    {isDual && (
                      <div
                        style={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          background: "#0891b2",
                          color: "white",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: "bold",
                        }}
                      >
                        2
                      </div>
                    )}

                    {/* Pod Number */}
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        textAlign: "center",
                        color: isDual ? "#0891b2" : "#374151",
                      }}
                    >
                      {pod.number}
                    </div>

                    {/* Pod Type Label */}
                    <div
                      style={{
                        fontSize: "0.7rem",
                        textAlign: "center",
                        color: "#6b7280",
                        marginTop: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {isDual ? `Dual w/ ${partnerPod?.number || "?"}` : "Single"}
                    </div>

                    {/* Unlink Button for Dual Pods */}
                    {isDual && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unlinkDualPod(pod.id);
                        }}
                        disabled={saving}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "6px 8px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: 6,
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          fontWeight: "500",
                        }}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 8,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: "2px solid #e5e7eb",
              background: "white",
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Single Pod</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: "3px solid #22d3ee",
              background: "#ecfeff",
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Dual Pod</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: "3px solid #3b82f6",
              background: "#eff6ff",
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Selected</span>
        </div>
      </div>
    </div>
  );
}
