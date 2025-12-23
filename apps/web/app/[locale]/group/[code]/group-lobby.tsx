"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { API_URL } from "@/lib/api";
import { useGuest } from "@/contexts/guest-context";
import SeatingMap, { Seat } from "@/components/SeatingMap";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";

type GroupOrder = {
  id: string;
  code: string;
  hostUserId: string | null;
  hostGuestId: string | null;
  locationId: string;
  tenantId: string;
  status: "GATHERING" | "CLOSED" | "PAYING" | "PAID" | "PARTIALLY_PAID" | "CANCELLED";
  paymentMethod: "HOST_PAYS_ALL" | "PAY_YOUR_OWN" | null;
  expiresAt: string;
  closedAt: string | null;
  estimatedArrival: string | null;
  location: {
    id: string;
    name: string;
    address: string;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    userId: string | null;
    guestId: string | null;
    isGroupHost: boolean;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    guest: {
      id: string;
      name: string | null;
    } | null;
    seat: {
      id: string;
      number: string;
      label: string | null;
      seatType: string;
    } | null;
    items: Array<{
      id: string;
      quantity: number;
      priceCents: number;
      selectedValue: string | null;
      menuItem: {
        name: string;
        category: string | null;
      };
    }>;
  }>;
};

type GroupLobbyProps = {
  initialGroup: GroupOrder;
};

export default function GroupLobby({ initialGroup }: GroupLobbyProps) {
  const router = useRouter();
  const t = useTranslations("order");
  const toast = useToast();
  const { user, isLoaded: userLoaded } = useUser();
  const { guest, isGuest, startGuestSession, isLoading: guestLoading } = useGuest();
  const [group, setGroup] = useState<GroupOrder>(initialGroup);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  // Start as true to prevent premature "ready" state before we check for user
  const [dbUserLoading, setDbUserLoading] = useState(true);
  // Track expanded orders for showing details
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Pod/seat selection for the group
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  // Pod seating options for final selection (when all paid)
  const [selectedSeatingOption, setSelectedSeatingOption] = useState<number | null>(null);
  const [completingOrder, setCompletingOrder] = useState(false);

  // Confirm dialog states
  const [closeGroupConfirmOpen, setCloseGroupConfirmOpen] = useState(false);
  const [cancelGroupConfirmOpen, setCancelGroupConfirmOpen] = useState(false);
  const [removeOrderConfirmOpen, setRemoveOrderConfirmOpen] = useState(false);

  // Fetch database user ID when Clerk user is available
  // Always fetch to ensure we have the correct user ID for the current Clerk user
  useEffect(() => {
    async function fetchDbUser() {
      if (!userLoaded) return;

      // If no Clerk user, clear dbUserId and stop loading
      if (!user?.primaryEmailAddress?.emailAddress) {
        setDbUserId(null);
        setDbUserLoading(false);
        return;
      }

      setDbUserLoading(true);
      try {
        console.log("[GroupLobby] Fetching db user for:", user.primaryEmailAddress.emailAddress);
        const res = await fetch(`${API_URL}/users`, {
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

        if (res.ok) {
          const userData = await res.json();
          console.log("[GroupLobby] Got db user ID:", userData.id);
          setDbUserId(userData.id);
          localStorage.setItem("userId", userData.id);
          localStorage.setItem("referralCode", userData.referralCode);
        } else {
          console.error("[GroupLobby] Failed to create/fetch db user:", res.status);
        }
      } catch (e) {
        console.error("[GroupLobby] Failed to fetch db user:", e);
      } finally {
        setDbUserLoading(false);
      }
    }

    fetchDbUser();
  }, [userLoaded, user?.primaryEmailAddress?.emailAddress, user?.fullName, user?.firstName]);

  // Check if current user is the host (compare database user IDs or guest IDs)
  const isHost = (dbUserId && dbUserId === group.hostUserId) ||
                 (isGuest && guest?.id && guest.id === group.hostGuestId);

  // Check if current user has an order in this group (compare database user IDs)
  const myOrder = dbUserId
    ? group.orders.find(o => o.userId === dbUserId)
    : isGuest && guest?.id
      ? group.orders.find(o => o.guestId === guest.id)
      : null;

  // Check if user is already in the group
  const isInGroup = !!myOrder;

  // Time remaining before expiry
  const expiresAt = new Date(group.expiresAt);
  // Initialize to null to avoid hydration mismatch (Date.now() differs server vs client)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate and update time remaining on client only
  useEffect(() => {
    // Calculate initial time remaining
    const calcRemaining = () => {
      const now = new Date();
      return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    };

    setTimeRemaining(calcRemaining());

    const interval = setInterval(() => {
      const remaining = calcRemaining();
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Refresh the page when group expires
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, router]);

  // Poll for updates every 5 seconds
  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/group-orders/${group.code}`, {
        headers: { "x-tenant-slug": "oh" },
      });
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (e) {
      console.error("Failed to refresh group:", e);
    }
  }, [group.code]);

  useEffect(() => {
    const interval = setInterval(fetchGroup, 5000);
    return () => clearInterval(interval);
  }, [fetchGroup]);

  // Fetch seats for the location
  const fetchSeats = useCallback(async () => {
    if (!group.locationId) return;
    setLoadingSeats(true);
    try {
      const res = await fetch(`${API_URL}/locations/${group.locationId}/seats`, {
        headers: { "x-tenant-slug": "oh" },
      });
      if (res.ok) {
        const seatsData = await res.json();
        const mappedSeats: Seat[] = seatsData.map((s: any) => ({
          id: s.id,
          number: s.number,
          status: s.status,
          side: s.side || "left",
          row: s.row || 0,
          col: s.col || 0,
          podType: s.podType || "SINGLE",
          dualPartnerId: s.dualPartnerId || null,
        }));
        setSeats(mappedSeats);
      }
    } catch (e) {
      console.error("Failed to fetch seats:", e);
    } finally {
      setLoadingSeats(false);
    }
  }, [group.locationId]);

  // Initial fetch of seats and poll every 10 seconds
  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 10000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  // Format time remaining
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if user credentials are ready to use
  const credentialsReady = !!(dbUserId || (isGuest && guest?.id));
  const isLoadingCredentials = !userLoaded || guestLoading || dbUserLoading;

  // Join the group
  async function handleJoin() {
    console.log("[GroupLobby] handleJoin called", {
      userLoaded,
      dbUserId,
      dbUserLoading,
      isGuest,
      guestId: guest?.id,
      clerkEmail: user?.primaryEmailAddress?.emailAddress,
    });

    if (!userLoaded) {
      console.log("[GroupLobby] Aborting join - user not loaded");
      return;
    }

    // Wait for dbUserId if Clerk user exists but dbUserId hasn't loaded yet
    if (user?.primaryEmailAddress?.emailAddress && !dbUserId && !dbUserLoading) {
      console.log("[GroupLobby] Aborting join - Clerk user exists but dbUserId not loaded");
      setError("Loading user data... Please try again in a moment.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      // Get the proper user/guest ID
      let userId: string | null = null;
      let guestId: string | null = null;

      if (dbUserId) {
        userId = dbUserId;
      } else if (isGuest && guest?.id) {
        guestId = guest.id;
      } else {
        console.log("[GroupLobby] No credentials available - showing error");
        setError("Please sign in or continue as guest to join this group.");
        setJoining(false);
        return;
      }

      // Double-check we have valid credentials
      if (!userId && !guestId) {
        console.log("[GroupLobby] Double-check failed - no credentials");
        setError("Unable to identify user. Please refresh and try again.");
        setJoining(false);
        return;
      }

      console.log("[GroupLobby] Calling join API with:", { userId, guestId });
      const res = await fetch(`${API_URL}/group-orders/${group.code}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          userId,
          guestId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to join group");
        setJoining(false);
        return;
      }

      // Refresh the group data
      await fetchGroup();

      // Redirect to order page with group context
      router.push(`/order/location/${group.locationId}?groupCode=${group.code}`);
    } catch (e) {
      console.error("Failed to join:", e);
      setError("Failed to join group. Please try again.");
      setJoining(false);
    }
  }

  // Copy share link
  function copyShareLink() {
    const url = `${window.location.origin}/group/${group.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Host controls: close group (stop new members)
  async function handleCloseGroup() {
    try {
      const res = await fetch(`${API_URL}/group-orders/${group.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: "CLOSED" }),
      });

      if (res.ok) {
        await fetchGroup();
      }
    } catch (e) {
      console.error("Failed to close group:", e);
    }
  }

  // Host controls: cancel group order
  async function handleCancelGroup() {
    try {
      const res = await fetch(`${API_URL}/group-orders/${group.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (res.ok) {
        router.push("/order");
      }
    } catch (e) {
      console.error("Failed to cancel group:", e);
    }
  }

  // Toggle order detail expansion
  function toggleOrderExpand(orderId: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  // Get display name for an order
  function getOrderDisplayName(order: GroupOrder["orders"][0]): string {
    if (order.user?.name) return order.user.name;
    if (order.guest?.name && order.guest.name !== "Guest") return order.guest.name;
    if (order.user?.email) {
      // Extract name from email (e.g., "john.doe@example.com" -> "John")
      const emailName = order.user.email.split("@")[0].split(".")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return order.isGroupHost ? "Host" : "Guest";
  }

  // Group order items by category for display
  function groupOrderItems(items: GroupOrder["orders"][0]["items"]) {
    const bowlItems = items.filter(item => {
      const cat = item.menuItem.category || "";
      return cat.startsWith("main") || cat.startsWith("slider");
    });
    const extrasItems = items.filter(item => {
      const cat = item.menuItem.category || "";
      return cat.startsWith("add-on") || cat.startsWith("side") || cat.startsWith("drink") || cat.startsWith("dessert");
    });
    return { bowlItems, extrasItems };
  }

  // Host controls: set payment method
  async function handleSetPaymentMethod(method: "HOST_PAYS_ALL" | "PAY_YOUR_OWN") {
    try {
      const res = await fetch(`${API_URL}/group-orders/${group.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({ paymentMethod: method }),
      });

      if (res.ok) {
        await fetchGroup();
      }
    } catch (e) {
      console.error("Failed to set payment method:", e);
    }
  }

  // Complete group order - notify kitchen and cleaning staff
  async function handleCompleteGroupOrder() {
    if (selectedSeatingOption === null) {
      toast.warning(t("group.selectSeating"));
      return;
    }

    setCompletingOrder(true);
    try {
      // Get available seats to assign based on selected option
      const availableSeats = seats.filter(s => s.status === "AVAILABLE");
      const seatsNeeded = group.orders.length;

      // Simple seat assignment based on option (1 = first available, 2 = middle section, 3 = end section)
      let assignedSeatIds: string[] = [];
      if (availableSeats.length >= seatsNeeded) {
        // Assign consecutive available seats based on option
        const startIndex = selectedSeatingOption === 1 ? 0 :
                          selectedSeatingOption === 2 ? Math.floor(availableSeats.length / 3) :
                          Math.floor(availableSeats.length * 2 / 3);
        assignedSeatIds = availableSeats.slice(startIndex, startIndex + seatsNeeded).map(s => s.id);
      }

      // Mark group as ready for kitchen
      const res = await fetch(`${API_URL}/group-orders/${group.code}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          seatIds: assignedSeatIds,
          seatingOption: selectedSeatingOption,
        }),
      });

      if (res.ok) {
        await fetchGroup();
        toast.success(t("group.orderCompleted"));
        router.push(`/order/confirmation?groupCode=${group.code}`);
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.error || t("errors.groupCompleteFailed"));
      }
    } catch (e) {
      console.error("Failed to complete group order:", e);
      toast.error(t("errors.groupCompleteFailed"));
    } finally {
      setCompletingOrder(false);
    }
  }

  // Remove my order from group
  async function handleRemoveMyOrder() {
    if (!myOrder) return;

    try {
      const res = await fetch(`${API_URL}/group-orders/${group.code}/orders/${myOrder.id}`, {
        method: "DELETE",
        headers: { "x-tenant-slug": "oh" },
      });

      if (res.ok) {
        await fetchGroup();
      }
    } catch (e) {
      console.error("Failed to remove order:", e);
    }
  }

  // Status badge
  const getStatusBadge = () => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      GATHERING: { color: "#22c55e", text: "Gathering Orders" },
      CLOSED: { color: "#f59e0b", text: "Closed - Ready to Pay" },
      PAYING: { color: "#3b82f6", text: "Processing Payment" },
      PAID: { color: "#7C7A67", text: "Paid" },
      PARTIALLY_PAID: { color: "#f59e0b", text: "Partially Paid" },
      CANCELLED: { color: "#ef4444", text: "Cancelled" },
    };

    const config = statusConfig[group.status] || statusConfig.GATHERING;

    return (
      <span
        style={{
          padding: "6px 12px",
          background: config.color + "20",
          color: config.color,
          borderRadius: 20,
          fontWeight: 600,
          fontSize: "0.85rem",
        }}
      >
        {config.text}
      </span>
    );
  };

  // Calculate group total
  const groupTotal = group.orders.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 24px",
            background: "#f9fafb",
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>👥</span>
          <span style={{ fontSize: "2rem", fontWeight: "bold", letterSpacing: "0.15em" }}>
            {group.code}
          </span>
          <button
            onClick={copyShareLink}
            style={{
              padding: "6px 12px",
              background: copied ? "#22c55e" : "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>

        <h1 style={{ marginBottom: 8 }}>Group Order at {group.location.name}</h1>
        <p style={{ color: "#666", marginBottom: 16 }}>{group.location.address}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {getStatusBadge()}
          {group.status === "GATHERING" && (
            <span style={{ color: "#666", fontSize: "0.9rem" }}>
              Expires in {formatTime(timeRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Join prompt - show if not in group, not the host, and status is GATHERING */}
      {!isInGroup && !isHost && group.status === "GATHERING" && (
        <div
          style={{
            padding: 24,
            background: "#fef3e2",
            borderRadius: 12,
            border: "1px solid #f9a825",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: 8, color: "#92400e" }}>Join This Group?</h2>
          <p style={{ color: "#b45309", marginBottom: 16 }}>
            Add your order to dine together with this group
          </p>
          {error && (
            <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
          )}

          {/* Show loading state */}
          {isLoadingCredentials && (
            <button
              disabled
              style={{
                padding: "12px 32px",
                background: "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "wait",
              }}
            >
              Loading...
            </button>
          )}

          {/* Show Sign In / Guest options when not authenticated */}
          {!isLoadingCredentials && !credentialsReady && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <SignInButton mode="modal">
                <button
                  style={{
                    padding: "12px 32px",
                    background: "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: "pointer",
                  }}
                >
                  Sign In to Join
                </button>
              </SignInButton>
              <div style={{ color: "#7C7A67", fontSize: "0.9rem" }}>or</div>
              <button
                onClick={async () => {
                  await startGuestSession();
                }}
                style={{
                  padding: "10px 24px",
                  background: "transparent",
                  color: "#7C7A67",
                  border: "1px solid #7C7A67",
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Continue as Guest
              </button>
            </div>
          )}

          {/* Show Join button when authenticated */}
          {!isLoadingCredentials && credentialsReady && (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                padding: "12px 32px",
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "1rem",
                cursor: joining ? "wait" : "pointer",
              }}
            >
              {joining ? "Joining..." : "Join Group & Order"}
            </button>
          )}
        </div>
      )}

      {/* Host welcome - show if host but hasn't placed an order yet */}
      {isHost && !isInGroup && group.status === "GATHERING" && (
        <div
          style={{
            padding: 24,
            background: "#f0fdf4",
            borderRadius: 12,
            border: "1px solid #86efac",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: 8, color: "#166534" }}>You're the Host!</h2>
          <p style={{ color: "#15803d", marginBottom: 16 }}>
            Share the code above with friends. You can place your order anytime.
          </p>
          <a
            href={`/order/location/${group.locationId}?groupCode=${group.code}`}
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "1rem",
              textDecoration: "none",
            }}
          >
            Place Your Order
          </a>
        </div>
      )}

      {/* My order status - show if in group */}
      {isInGroup && myOrder && (
        <div
          style={{
            padding: 20,
            background: "#f0fdf4",
            borderRadius: 12,
            border: "1px solid #86efac",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "#22c55e", fontWeight: 600 }}>Your Order</span>
              <span style={{ marginLeft: 8, color: "#666" }}>#{myOrder.orderNumber}</span>
            </div>
            <strong>${(myOrder.totalCents / 100).toFixed(2)}</strong>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <a
              href={`/order/location/${group.locationId}?groupCode=${group.code}&edit=${myOrder.id}`}
              style={{
                padding: "8px 16px",
                background: "#7C7A67",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Edit Order
            </a>
            {myOrder.status === "PENDING_PAYMENT" && (
              <button
                onClick={() => setRemoveOrderConfirmOpen(true)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#ef4444",
                  border: "1px solid #ef4444",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Remove
              </button>
            )}
          </div>

          {/* Host Controls - integrated into "Your Order" block */}
          {isHost && (group.status === "GATHERING" || group.status === "CLOSED") && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #86efac" }}>
              <h4 style={{ marginBottom: 12, color: "#166534", fontSize: "0.95rem" }}>Host Controls</h4>

              {/* Payment Method Selection */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.85rem", color: "#15803d", marginBottom: 8 }}>Payment Method</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleSetPaymentMethod("HOST_PAYS_ALL")}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: group.paymentMethod === "HOST_PAYS_ALL" ? "#166534" : "white",
                      color: group.paymentMethod === "HOST_PAYS_ALL" ? "white" : "#166534",
                      border: "1px solid #166534",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: group.paymentMethod === "HOST_PAYS_ALL" ? 600 : 400,
                      fontSize: "0.85rem",
                    }}
                  >
                    I'll Pay for Everyone
                  </button>
                  <button
                    onClick={() => handleSetPaymentMethod("PAY_YOUR_OWN")}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: group.paymentMethod === "PAY_YOUR_OWN" ? "#166534" : "white",
                      color: group.paymentMethod === "PAY_YOUR_OWN" ? "white" : "#166534",
                      border: "1px solid #166534",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: group.paymentMethod === "PAY_YOUR_OWN" ? 600 : 400,
                      fontSize: "0.85rem",
                    }}
                  >
                    Everyone Pays Separately
                  </button>
                </div>
              </div>

              {/* Group Action Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {group.status === "GATHERING" && (
                  <button
                    onClick={() => setCloseGroupConfirmOpen(true)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Close Group
                  </button>
                )}
                <button
                  onClick={() => setCancelGroupConfirmOpen(true)}
                  style={{
                    flex: group.status === "GATHERING" ? 1 : "unset",
                    padding: "10px 12px",
                    background: "transparent",
                    color: "#ef4444",
                    border: "1px solid #ef4444",
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Cancel Group Order
                </button>
              </div>

              {/* Pod Selection & Payment - when closed and payment method selected */}
              {group.status === "CLOSED" && group.paymentMethod === "HOST_PAYS_ALL" && group.orders.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {/* Step 1: Select Seating Option */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: "0.85rem", color: "#15803d", marginBottom: 8 }}>
                      Select Seating Area
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {[1, 2, 3].map((option) => {
                        const isSelected = selectedSeatingOption === option;
                        const optionLabels = ["Near Entrance", "Center Section", "Near Exit"];
                        return (
                          <button
                            key={option}
                            onClick={() => setSelectedSeatingOption(option)}
                            style={{
                              padding: "12px 16px",
                              background: isSelected ? "#166534" : "white",
                              color: isSelected ? "white" : "#166534",
                              border: "1px solid #166534",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontWeight: isSelected ? 600 : 400,
                              fontSize: "0.85rem",
                              textAlign: "left",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span>Option {option}: {optionLabels[option - 1]}</span>
                            {isSelected && <span>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Pay for Group (only enabled after selecting seating) */}
                  <a
                    href={selectedSeatingOption ? `/order/group-payment?groupCode=${group.code}&seatingOption=${selectedSeatingOption}` : "#"}
                    onClick={(e) => {
                      if (!selectedSeatingOption) {
                        e.preventDefault();
                        toast.warning(t("group.selectSeating"));
                      }
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px",
                      background: selectedSeatingOption ? "#166534" : "#9ca3af",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      textAlign: "center",
                      textDecoration: "none",
                      fontSize: "0.95rem",
                      boxSizing: "border-box",
                      cursor: selectedSeatingOption ? "pointer" : "not-allowed",
                    }}
                  >
                    {selectedSeatingOption
                      ? `Pay for Group ($${(groupTotal / 100).toFixed(2)})`
                      : "Select seating to continue"}
                  </a>
                </div>
              )}

              {/* PAY_YOUR_OWN - host pays for their own order */}
              {group.status === "CLOSED" && group.paymentMethod === "PAY_YOUR_OWN" && group.orders.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {myOrder && myOrder.paymentStatus !== "PAID" ? (
                    <a
                      href={`/order/payment?orderId=${myOrder.id}&orderNumber=${myOrder.orderNumber}&total=${myOrder.totalCents}`}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px",
                        background: "#166534",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        textAlign: "center",
                        textDecoration: "none",
                        fontSize: "0.95rem",
                        boxSizing: "border-box",
                      }}
                    >
                      Pay for My Order (${(myOrder.totalCents / 100).toFixed(2)})
                    </a>
                  ) : myOrder?.paymentStatus === "PAID" ? (
                    <p style={{ textAlign: "center", color: "#15803d", fontSize: "0.9rem", margin: 0 }}>
                      Your order is paid! Waiting for other members.
                    </p>
                  ) : (
                    <p style={{ textAlign: "center", color: "#15803d", fontSize: "0.9rem", margin: 0 }}>
                      Add an order to pay for it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group members / orders */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>
              {group.orders.length} {group.orders.length === 1 ? "Order" : "Orders"}
            </span>
            <span style={{ color: "#666" }}>
              Max 8 people
            </span>
          </div>
          {group.paymentMethod && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                background: group.paymentMethod === "HOST_PAYS_ALL" ? "#fef3e2" : "#f0f9ff",
                borderRadius: 6,
                fontSize: "0.85rem",
                color: group.paymentMethod === "HOST_PAYS_ALL" ? "#92400e" : "#0369a1",
              }}
            >
              {group.paymentMethod === "HOST_PAYS_ALL"
                ? "The host is paying for this group order!"
                : "Everyone paying separately."}
            </div>
          )}
        </div>

        {group.orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
            No orders yet. Be the first to add yours!
          </div>
        ) : (
          <div>
            {group.orders.map((order, idx) => {
              const isExpanded = expandedOrders.has(order.id);
              const { bowlItems, extrasItems } = groupOrderItems(order.items);
              const displayName = getOrderDisplayName(order);

              return (
                <div
                  key={order.id}
                  style={{
                    borderBottom: idx < group.orders.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  {/* Order Header - Clickable */}
                  <div
                    onClick={() => toggleOrderExpand(order.id)}
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      background: isExpanded ? "#f9fafb" : "transparent",
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: "1.2rem", color: "#9ca3af" }}>
                        {isExpanded ? "−" : "+"}
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 500 }}>
                            {displayName}
                          </span>
                          <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                            #{order.orderNumber}
                          </span>
                          {order.isGroupHost && (
                            <span
                              style={{
                                padding: "2px 8px",
                                background: "#fef3e2",
                                color: "#92400e",
                                borderRadius: 4,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              HOST
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                          {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600 }}>${(order.totalCents / 100).toFixed(2)}</div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: order.paymentStatus === "PAID" ? "#22c55e" : "#f59e0b",
                        }}
                      >
                        {order.paymentStatus === "PAID"
                          ? "Payment Complete"
                          : group.paymentMethod === "HOST_PAYS_ALL"
                            ? "Pending Host Payment"
                            : "Payment Pending"}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div style={{ padding: "0 20px 16px 52px" }}>
                      {/* Bowl Items */}
                      {bowlItems.length > 0 && (
                        <div style={{ marginBottom: extrasItems.length > 0 ? 12 : 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                            The Bowl
                          </div>
                          <div
                            style={{
                              background: "rgba(124, 122, 103, 0.08)",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            {bowlItems.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "2px 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                <span>
                                  {item.menuItem.name}
                                  <span style={{ color: "#666", marginLeft: 6 }}>
                                    ({item.selectedValue || `Qty: ${item.quantity}`})
                                  </span>
                                </span>
                                {item.priceCents > 0 && (
                                  <span style={{ color: "#666" }}>
                                    ${(item.priceCents / 100).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extras Items */}
                      {extrasItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                            Add-ons & Extras
                          </div>
                          <div
                            style={{
                              background: "rgba(199, 168, 120, 0.1)",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            {extrasItems.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "2px 0",
                                  fontSize: "0.85rem",
                                }}
                              >
                                <span>
                                  {item.menuItem.name}
                                  <span style={{ color: "#666", marginLeft: 6 }}>
                                    (Qty: {item.quantity})
                                  </span>
                                </span>
                                {item.priceCents > 0 && (
                                  <span style={{ color: "#666" }}>
                                    ${(item.priceCents / 100).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Group total */}
        <div
          style={{
            padding: "16px 20px",
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Group Total</span>
          <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
            ${(groupTotal / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Pod View & Status for Paid Groups */}
      {(() => {
        // Check if all orders are paid (using paymentStatus, not status - status changes to QUEUED when paid)
        const allOrdersPaid = group.orders.length > 0 && group.orders.every(o => o.paymentStatus === "PAID");
        // Check if this is an ASAP arrival (estimatedArrival is within 5 minutes of now or null/undefined means ASAP)
        const isAsapArrival = !group.estimatedArrival ||
          (new Date(group.estimatedArrival).getTime() - Date.now() < 5 * 60 * 1000);
        const availableSeats = seats.filter(s => s.status === "AVAILABLE");

        // Show completion message when all paid (pod selection happens before payment now)
        if (allOrdersPaid && isAsapArrival) {
          // Get assigned pods for display
          const ordersWithPods = group.orders.filter(o => o.seat);
          const podNumbers = ordersWithPods.map(o => o.seat?.number).filter(Boolean);

          return (
            <div
              style={{
                background: "#f0fdf4",
                borderRadius: 12,
                border: "2px solid #22c55e",
                padding: 24,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✓</div>
              <h3 style={{ color: "#166534", marginBottom: 8 }}>Group Order Complete!</h3>
              <p style={{ color: "#15803d", marginBottom: 16 }}>
                All payments processed. The kitchen has been notified and is preparing your food!
              </p>

              {/* Show assigned pods */}
              {podNumbers.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: "0.9rem", color: "#166534", marginBottom: 8 }}>
                    Your Reserved Pods:
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    {podNumbers.map((podNum, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#166534",
                          color: "white",
                          padding: "12px 20px",
                          borderRadius: 8,
                          fontWeight: "bold",
                          fontSize: "1.2rem",
                        }}
                      >
                        Pod {podNum}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div
                style={{
                  background: "rgba(22, 101, 52, 0.1)",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600, color: "#166534", marginBottom: 8 }}>Next Steps:</div>
                <ol style={{ margin: 0, paddingLeft: 20, color: "#15803d", fontSize: "0.9rem" }}>
                  <li style={{ marginBottom: 4 }}>Head to {group.location.name}</li>
                  <li style={{ marginBottom: 4 }}>Find your assigned pod{podNumbers.length > 1 ? "s" : ""}</li>
                  <li style={{ marginBottom: 4 }}>Scan the QR code on your table to confirm arrival</li>
                  <li>Your food will be served shortly after!</li>
                </ol>
              </div>

              {myOrder && (
                <a
                  href={`/order/confirmation?orderId=${myOrder.id}&orderNumber=${myOrder.orderNumber}&groupCode=${group.code}&total=${myOrder.totalCents}&paid=true`}
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: "#166534",
                    color: "white",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  View My Order Details
                </a>
              )}
            </div>
          );
        }

        // For non-ASAP arrivals, show info about pod assignment
        if (allOrdersPaid && !isAsapArrival) {
          return (
            <div
              style={{
                background: "#f0f9ff",
                borderRadius: 12,
                border: "1px solid #0ea5e9",
                padding: 20,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "#0369a1", marginBottom: 8 }}>All Payments Complete!</h3>
              <p style={{ color: "#0284c7", margin: 0 }}>
                Since you selected a later arrival time, pods will be automatically assigned when you check in at the kiosk.
                Your food will be ready when you arrive!
              </p>
            </div>
          );
        }

        // Regular pod view for gathering/closed groups (viewing only)
        if (seats.length > 0 && (group.status === "GATHERING" || group.status === "CLOSED")) {
          return (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>Available Pods</span>
                  <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: 8 }}>
                    Live view - updates every 10s
                  </span>
                </div>
                <button
                  onClick={fetchSeats}
                  disabled={loadingSeats}
                  style={{
                    padding: "6px 12px",
                    background: loadingSeats ? "#d1d5db" : "#7C7A67",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: loadingSeats ? "not-allowed" : "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  {loadingSeats ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div style={{ padding: 20 }}>
                <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 16, textAlign: "center" }}>
                  View pod availability for your group. Pods will be assigned when you check in at the restaurant.
                </p>

                {loadingSeats ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ color: "#666" }}>Loading pod availability...</div>
                  </div>
                ) : (
                  <SeatingMap
                    seats={seats}
                    selectedSeatId={selectedSeatId}
                    onSelectSeat={(seat) => setSelectedSeatId(seat.id)}
                    disabled={true}
                    groupSize={group.orders.length}
                  />
                )}

                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: "#f9fafb",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>
                    {availableSeats.length} of {seats.length} pods available
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Non-host payment prompt */}
      {!isHost && isInGroup && group.status === "CLOSED" && group.paymentMethod === "PAY_YOUR_OWN" && myOrder?.paymentStatus !== "PAID" && (
        <div
          style={{
            padding: 20,
            background: "#f0f9ff",
            borderRadius: 12,
            border: "1px solid #0ea5e9",
            textAlign: "center",
          }}
        >
          <h3 style={{ marginBottom: 8, color: "#0369a1" }}>Time to Pay!</h3>
          <p style={{ color: "#0284c7", marginBottom: 16 }}>
            The group is closed. Pay for your order to complete checkout.
          </p>
          <a
            href={`/order/payment?orderId=${myOrder?.id}&orderNumber=${myOrder?.orderNumber}&total=${myOrder?.totalCents}`}
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: "#7C7A67",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Pay ${((myOrder?.totalCents || 0) / 100).toFixed(2)}
          </a>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={closeGroupConfirmOpen}
        onClose={() => setCloseGroupConfirmOpen(false)}
        onConfirm={async () => {
          await handleCloseGroup();
        }}
        title={t("group.closeGroupTitle")}
        message={t("group.closeGroupMessage")}
        type="warning"
      />

      <ConfirmDialog
        open={cancelGroupConfirmOpen}
        onClose={() => setCancelGroupConfirmOpen(false)}
        onConfirm={async () => {
          await handleCancelGroup();
        }}
        title={t("group.cancelGroupTitle")}
        message={t("group.cancelGroupMessage")}
        type="danger"
      />

      <ConfirmDialog
        open={removeOrderConfirmOpen}
        onClose={() => setRemoveOrderConfirmOpen(false)}
        onConfirm={async () => {
          await handleRemoveMyOrder();
        }}
        title={t("group.removeOrderTitle")}
        message={t("group.removeOrderMessage")}
        type="warning"
      />
    </main>
  );
}
