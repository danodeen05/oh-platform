"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { useGuest } from "@/contexts/guest-context";
import { useToast } from "@/components/ui/Toast";
import { trackLocationSelected, event } from "@/lib/analytics";

type Location = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  tenantId: string;
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
  groupMode = false,
}: {
  locations: Location[];
  referralCode?: string;
  groupMode?: boolean;
}) {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { guest, isGuest } = useGuest();
  const t = useTranslations("order");
  const toast = useToast();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [sortedLocations, setSortedLocations] = useState(locations);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    // Only attempt geolocation on secure connections (HTTPS)
    // Browsers block geolocation on HTTP for security reasons
    const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;

    if (isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
        },
        (error) => {
          // Silently handle geolocation errors (user denied, etc.)
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

  async function selectLocation(location: Location) {
    // Track location selection
    trackLocationSelected({
      id: location.id,
      name: location.name,
      city: location.city,
    });

    // Store referral code in localStorage if provided
    if (referralCode) {
      console.log("Storing referral code:", referralCode);
      localStorage.setItem("pendingReferralCode", referralCode);
    }

    // If in group mode, create a group order and redirect to lobby
    if (groupMode) {
      if (!userLoaded) return;

      setCreatingGroup(true);
      try {
        let hostUserId: string | null = null;
        let hostGuestId: string | null = null;

        // If user is signed in with Clerk, get/create their database user ID
        if (user?.primaryEmailAddress?.emailAddress) {
          const userResponse = await fetch(`${API_URL}/users`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-slug": "oh",
            },
            body: JSON.stringify({
              email: user.primaryEmailAddress.emailAddress,
              name: user.fullName || user.firstName || undefined,
            }),
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            hostUserId = userData.id;
            // Store for future use
            localStorage.setItem("userId", userData.id);
            localStorage.setItem("referralCode", userData.referralCode);
          }
        } else if (isGuest && guest?.id) {
          // Use guest ID if in guest mode
          hostGuestId = guest.id;
        }

        if (!hostUserId && !hostGuestId) {
          toast.error(t("errors.signInRequired"));
          setCreatingGroup(false);
          return;
        }

        const response = await fetch(`${API_URL}/group-orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            locationId: location.id,
            tenantId: location.tenantId,
            hostUserId,
            hostGuestId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          toast.error(error.error || t("errors.groupOrderFailed"));
          setCreatingGroup(false);
          return;
        }

        const groupOrder = await response.json();
        // Redirect to the group lobby
        router.push(`/group/${groupOrder.code}`);
      } catch (error) {
        console.error("Failed to create group order:", error);
        toast.error(t("errors.groupOrderRetry"));
        setCreatingGroup(false);
      }
      return;
    }

    // Normal solo ordering flow
    router.push(`/order/location/${location.id}`);
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Group mode header */}
      {groupMode && (
        <div
          style={{
            padding: 16,
            background: "#fef3e2",
            borderRadius: 8,
            border: "1px solid #f9a825",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>👥</span>
            <span style={{ fontWeight: 600, color: "#92400e" }}>
              {t("locationSelector.groupMode.title")}
            </span>
          </div>
          <p style={{ color: "#b45309", fontSize: "0.9rem", margin: "8px 0 0" }}>
            {t("locationSelector.groupMode.description")}
          </p>
        </div>
      )}

      {sortedLocations.map((loc: any) => {
        const availabilityPct = loc.stats
          ? (loc.stats.availableSeats / loc.stats.totalSeats) * 100
          : 100;

        let statusColor = "#22c55e";
        let statusText = t("locationSelector.status.available");

        if (availabilityPct < 30) {
          statusColor = "#ef4444";
          statusText = t("locationSelector.status.busy");
        } else if (availabilityPct < 60) {
          statusColor = "#f59e0b";
          statusText = t("locationSelector.status.moderateWait");
        }

        return (
          <div
            key={loc.id}
            onClick={() => !creatingGroup && selectLocation(loc)}
            style={{
              border: groupMode ? "2px solid #7C7A67" : "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24,
              opacity: creatingGroup ? 0.6 : 1,
              pointerEvents: creatingGroup ? "none" : "auto",
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
                    📍 {t("locationSelector.milesAway", { distance: loc.distance.toFixed(1) })}
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
                  <span style={{ color: "#9ca3af" }}>{t("locationSelector.available")} </span>
                  <strong>
                    {t("locationSelector.pods", { available: loc.stats.availableSeats, total: loc.stats.totalSeats })}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#9ca3af" }}>{t("locationSelector.avgWait")} </span>
                  <strong>{t("locationSelector.minWait", { minutes: loc.stats.avgWaitMinutes })}</strong>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
