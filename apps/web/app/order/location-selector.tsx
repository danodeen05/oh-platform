"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Location = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  stats?: {
    availableSeats: number;
    totalSeats: number;
    avgWaitMinutes: number;
  };
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LocationSelector({
  locations,
  referralCode,
}: {
  locations: Location[];
  referralCode?: string;
}) {
  const router = useRouter();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [sortedLocations, setSortedLocations] = useState(locations);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
        },
        (error) => {
          console.log("Location access denied:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (userLat && userLng) {
      const withDistance = locations.map((loc) => ({
        ...loc,
        distance: calculateDistance(userLat, userLng, loc.lat, loc.lng),
      }));
      const sorted = withDistance.sort((a, b) => a.distance - b.distance);
      setSortedLocations(sorted);
    }
  }, [userLat, userLng, locations]);

  function selectLocation(locationId: string) {
    // Store referral code in localStorage if provided
    if (referralCode) {
      localStorage.setItem("pendingReferralCode", referralCode);
    }
    router.push(`/order/location/${locationId}`);
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {sortedLocations.map((loc: any) => {
        const availabilityPct = loc.stats
          ? (loc.stats.availableSeats / loc.stats.totalSeats) * 100
          : 100;

        let statusColor = "#22c55e";
        let statusText = "Available";

        if (availabilityPct < 30) {
          statusColor = "#ef4444";
          statusText = "Busy";
        } else if (availabilityPct < 60) {
          statusColor = "#f59e0b";
          statusText = "Moderate Wait";
        }

        return (
          <div
            key={loc.id}
            onClick={() => selectLocation(loc.id)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24,
              cursor: "pointer",
              transition: "all 0.2s",
              background: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.1)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, marginBottom: 4 }}>{loc.name}</h2>
                <p style={{ color: "#666", margin: 0, fontSize: "0.9rem" }}>
                  {loc.address}
                </p>
                {loc.distance && (
                  <p
                    style={{
                      color: "#9ca3af",
                      margin: 0,
                      fontSize: "0.85rem",
                      marginTop: 4,
                    }}
                  >
                    📍 {loc.distance.toFixed(1)} miles away
                  </p>
                )}
              </div>

              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: statusColor + "20",
                  color: statusColor,
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                {statusText}
              </div>
            </div>

            {loc.stats && (
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #f3f4f6",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <span style={{ color: "#9ca3af" }}>Available: </span>
                  <strong>
                    {loc.stats.availableSeats}/{loc.stats.totalSeats} seats
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#9ca3af" }}>Avg Wait: </span>
                  <strong>{loc.stats.avgWaitMinutes} min</strong>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
