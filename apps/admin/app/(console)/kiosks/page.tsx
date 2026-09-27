"use client";

import { useState, useEffect } from "react";

// Auto-detect environment based on hostname
function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "http://localhost:4000";
  const host = window.location.hostname;
  if (host.includes("devadmin")) return "https://devapi.ohbeef.com";
  if (host.includes("ohbeef")) return "https://api.ohbeef.com";
  return "http://localhost:4000";
}

function getWebUrl() {
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof window === "undefined") return "http://localhost:3000";
  const host = window.location.hostname;
  if (host.includes("devadmin") || host.includes("devwebapp")) return "https://devwebapp.ohbeef.com";
  if (host.includes("ohbeef")) return "https://ohbeef.com";
  return "http://localhost:3000";
}

const API_URL = getApiUrl();
const WEB_URL = getWebUrl();

type KioskDevice = {
  id: string;
  deviceId: string;
  name: string;
  location: {
    id: string;
    name: string;
  };
  isActive: boolean;
  lastHeartbeat: string | null;
  appVersion: string | null;
  createdAt: string;
};

type Location = {
  id: string;
  name: string;
};

export default function KiosksPage() {
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New device form
  const [showForm, setShowForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ deviceId: "", name: "", locationId: "" });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [devRes, locRes] = await Promise.all([
        fetch(`${API_URL}/kiosk-devices`, {
          headers: { "x-tenant-slug": "oh" },
        }),
        fetch(`${API_URL}/locations`, {
          headers: { "x-tenant-slug": "oh" },
        }),
      ]);

      if (!devRes.ok) throw new Error("Failed to fetch devices");
      if (!locRes.ok) throw new Error("Failed to fetch locations");

      const [devData, locData] = await Promise.all([devRes.json(), locRes.json()]);
      setDevices(devData);
      setLocations(locData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDevice(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`${API_URL}/kiosk-devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify(newDevice),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create device");
        return;
      }

      setNewApiKey(data.apiKey);
      fetchData(); // Refresh list
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleActive(device: KioskDevice) {
    try {
      const res = await fetch(`${API_URL}/kiosk-devices/${device.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ isActive: !device.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update device");
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleDelete(device: KioskDevice) {
    if (!confirm(`Delete "${device.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_URL}/kiosk-devices/${device.id}`, {
        method: "DELETE",
        headers: { "x-tenant-slug": "oh" },
      });

      if (!res.ok) throw new Error("Failed to delete device");
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleSetupDevice(device: KioskDevice) {
    if (!confirm(`Setup "${device.name}" on this device?\n\nThis will generate a new API key and open the kiosk setup page.`)) return;

    try {
      const res = await fetch(`${API_URL}/kiosk-devices/${device.id}/rotate-key`, {
        method: "POST",
        headers: { "x-tenant-slug": "oh" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate setup URL");

      // Navigate directly to setup URL
      const setupUrl = `${WEB_URL}/en/kiosk/setup?key=${data.apiKey}`;
      window.location.href = setupUrl;
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleRotateKey(device: KioskDevice) {
    if (!confirm(`Generate new setup URL for "${device.name}"?\n\nThis will invalidate any previous setup URLs.`)) return;

    try {
      const res = await fetch(`${API_URL}/kiosk-devices/${device.id}/rotate-key`, {
        method: "POST",
        headers: { "x-tenant-slug": "oh" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rotate key");

      const setupUrl = `${WEB_URL}/en/kiosk/setup?key=${data.apiKey}`;
      await navigator.clipboard.writeText(setupUrl);
      alert(`Setup URL copied to clipboard!\n\n${setupUrl}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  function copySetupUrl(device: KioskDevice, apiKey?: string) {
    // Note: We don't have the API key for existing devices
    // The setup URL with key is only available at creation or after rotation
    const url = `${WEB_URL}/en/kiosk/setup`;
    navigator.clipboard.writeText(url);
    setCopiedId(device.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getStatusColor(lastHeartbeat: string | null): string {
    if (!lastHeartbeat) return "#9ca3af"; // gray - never connected
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    if (diff < 2 * 60 * 1000) return "#22c55e"; // green - online (< 2 min)
    if (diff < 10 * 60 * 1000) return "#eab308"; // yellow - stale (< 10 min)
    return "#ef4444"; // red - offline
  }

  function getStatusText(lastHeartbeat: string | null): string {
    if (!lastHeartbeat) return "Never connected";
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    if (diff < 2 * 60 * 1000) return "Online";
    if (diff < 10 * 60 * 1000) return "Stale";
    return "Offline";
  }

  function formatTime(dateStr: string | null): string {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Kiosk Configuration</h2>
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Kiosk Configuration</h2>
        <p style={{ color: "crimson" }}>Error: {error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Kiosk Configuration</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setNewApiKey(null);
            setFormError(null);
            setNewDevice({ deviceId: "", name: "", locationId: "" });
          }}
          style={{
            padding: "10px 20px",
            background: showForm ? "#6b7280" : "#5A5847",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Register New Device"}
        </button>
      </div>

      {/* New Device Form */}
      {showForm && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
          }}
        >
          {newApiKey ? (
            // Success - show API key and setup URL
            <div>
              <h3 style={{ margin: "0 0 16px", color: "#22c55e" }}>Device Registered Successfully!</h3>
              <p style={{ marginBottom: 16 }}>
                Copy this setup URL and open it on the kiosk device:
              </p>
              <div
                style={{
                  background: "#f3f4f6",
                  padding: 16,
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                  marginBottom: 16,
                }}
              >
                {WEB_URL}/en/kiosk/setup?key={newApiKey}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${WEB_URL}/en/kiosk/setup?key=${newApiKey}`);
                  alert("Setup URL copied to clipboard!");
                }}
                style={{
                  padding: "10px 20px",
                  background: "#5A5847",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  marginRight: 12,
                }}
              >
                Copy URL
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setNewApiKey(null);
                }}
                style={{
                  padding: "10px 20px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          ) : (
            // Form
            <form onSubmit={handleCreateDevice}>
              <h3 style={{ margin: "0 0 16px" }}>Register New Kiosk Device</h3>

              {formError && (
                <div style={{ color: "#ef4444", marginBottom: 16, fontSize: "0.9rem" }}>
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16, alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", fontWeight: 500 }}>
                    Device ID
                  </label>
                  <input
                    type="text"
                    value={newDevice.deviceId}
                    onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                    placeholder="elo-location-01"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", fontWeight: 500 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newDevice.name}
                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    placeholder="Front Counter Kiosk"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", fontWeight: 500 }}>
                    Location
                  </label>
                  <select
                    value={newDevice.locationId}
                    onChange={(e) => setNewDevice({ ...newDevice, locationId: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: "0.9rem",
                      background: "white",
                    }}
                  >
                    <option value="">Select location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{
                    padding: "10px 24px",
                    background: formLoading ? "#9ca3af" : "#5A5847",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    cursor: formLoading ? "wait" : "pointer",
                  }}
                >
                  {formLoading ? "Creating..." : "Register"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Devices Table */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                Status
              </th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                Device
              </th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                Location
              </th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                Last Seen
              </th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                Version
              </th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.875rem", fontWeight: 600 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
                  No kiosk devices registered yet
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: device.isActive ? getStatusColor(device.lastHeartbeat) : "#9ca3af",
                        }}
                      />
                      <span style={{ fontSize: "0.875rem", color: device.isActive ? "#374151" : "#9ca3af" }}>
                        {device.isActive ? getStatusText(device.lastHeartbeat) : "Disabled"}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 500 }}>{device.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280", fontFamily: "monospace" }}>
                      {device.deviceId}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.9rem" }}>{device.location.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: "0.875rem", color: "#6b7280" }}>
                    {formatTime(device.lastHeartbeat)}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: "#6b7280", fontFamily: "monospace" }}>
                    {device.appVersion || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleSetupDevice(device)}
                        title="Generate setup URL and open on this device"
                        style={{
                          padding: "6px 12px",
                          background: "#5A5847",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Setup This Device
                      </button>
                      <button
                        onClick={() => handleRotateKey(device)}
                        title="Generate new setup URL (copy to clipboard)"
                        style={{
                          padding: "6px 12px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          border: "none",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Copy Setup URL
                      </button>
                      <button
                        onClick={() => handleToggleActive(device)}
                        style={{
                          padding: "6px 12px",
                          background: device.isActive ? "#fef3c7" : "#d1fae5",
                          color: device.isActive ? "#92400e" : "#065f46",
                          border: "none",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        {device.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(device)}
                        style={{
                          padding: "6px 12px",
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: "none",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: "flex", gap: 24, fontSize: "0.8rem", color: "#6b7280" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          Online (&lt;2 min)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308" }} />
          Stale (&lt;10 min)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
          Offline (&gt;10 min)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af" }} />
          Never connected / Disabled
        </div>
      </div>
    </main>
  );
}
