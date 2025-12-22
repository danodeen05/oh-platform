"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { trackPurchase, event } from "@/lib/analytics";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("confirmation");
  const tStatus = useTranslations("orderStatus");
  const tGroup = useTranslations("groupOrder");
  const tCommon = useTranslations("common");
  const orderNumber = searchParams.get("orderNumber");
  const orderId = searchParams.get("orderId");
  const total = searchParams.get("total");
  const paid = searchParams.get("paid");
  const groupCode = searchParams.get("groupCode");
  const orderCount = searchParams.get("orderCount");
  const [copied, setCopied] = useState(false);
  const [shareText, setShareText] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [groupOrders, setGroupOrders] = useState<any[]>([]);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const purchaseTrackedRef = useRef(false);

  // Fetch order details (and group orders if applicable)
  useEffect(() => {
    if (!orderId) return;

    async function fetchOrder() {
      try {
        const response = await fetch(`${BASE}/orders/${orderId}`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (response.ok) {
          const data = await response.json();
          setOrder(data);

          // If this is a group order, fetch all orders in the group
          if (data.groupOrderId || groupCode) {
            const groupResponse = await fetch(`${BASE}/group-orders/${groupCode || data.groupOrderId}`, {
              headers: { "x-tenant-slug": "oh" },
            });
            if (groupResponse.ok) {
              const groupData = await groupResponse.json();
              if (groupData.orders) {
                setGroupOrders(groupData.orders);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      }
    }

    fetchOrder();
  }, [orderId, groupCode]);

  // Store active order QR code in localStorage for the banner
  useEffect(() => {
    if (order?.orderQrCode) {
      localStorage.setItem("activeOrderQrCode", order.orderQrCode);
    }
  }, [order?.orderQrCode]);

  // Track purchase event (only once per order)
  useEffect(() => {
    if (!order || !paid || paid !== "true" || purchaseTrackedRef.current) return;

    purchaseTrackedRef.current = true;

    const items = order.items?.map((item: any) => ({
      id: item.menuItem?.id || item.id,
      name: item.menuItem?.name || "Unknown Item",
      price: (item.priceCents || 0) / 100,
      quantity: item.quantity || 1,
    })) || [];

    trackPurchase({
      orderId: order.id || orderId || "",
      total: (order.totalCents || parseInt(total || "0")) / 100,
      items,
    });

    // Track social sharing intent
    event({
      action: "order_confirmed",
      category: "conversion",
      label: order.orderNumber || orderNumber || "",
      value: order.totalCents || parseInt(total || "0"),
    });
  }, [order, paid, orderId, orderNumber, total]);

  // Check for native share capability after hydration
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    // Get user's referral code from localStorage
    const referralCode = localStorage.getItem("referralCode");

    // Build share text
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const referralUrl = referralCode
      ? `${baseUrl}/order?ref=${referralCode}`
      : baseUrl;

    const text = `Just ordered from Oh! Beef Noodle Soup 🍜🔥 Order #${orderNumber}\n\nBest beef noodles in town! Try it yourself and get $5 off your first order: ${referralUrl}`;
    setShareText(text);
  }, [orderNumber]);

  function handleShare(platform: string) {
    const encoded = encodeURIComponent(shareText);
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    let url = "";

    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encoded}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          baseUrl
        )}&quote=${encoded}`;
        break;
      case "linkedin":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          baseUrl
        )}`;
        break;
      case "copy":
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);

        // Award share badge (we'll implement this properly later)
        const userId = localStorage.getItem("userId");
        if (userId) {
          // TODO: Call API to award "first share" badge
          console.log("User shared their order! Award badge.");
        }
        return;
      default:
        return;
    }

    if (url) {
      window.open(url, "_blank", "width=600,height=400");

      // Track share event
      event({
        action: "share",
        category: "engagement",
        label: platform,
        content_type: "order",
        item_id: orderNumber || "",
      });

      // Award share badge
      const userId = localStorage.getItem("userId");
      if (userId) {
        // TODO: Call API to award "first share" badge
        console.log("User shared their order! Award badge.");
      }
    }
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator
        .share({
          title: "Oh! Beef Noodle Soup",
          text: shareText,
          url: window.location.origin,
        })
        .then(() => console.log("Shared successfully"))
        .catch((error) => console.log("Error sharing:", error));
    } else {
      // Fallback to copy
      handleShare("copy");
    }
  }

  const totalAmount = total ? (parseInt(total) / 100).toFixed(2) : "0.00";
  const isPaid = paid === "true";

  // Group items by category: Bowl (main, slider) vs Extras (add-on, side, drink, dessert)
  const bowlItems = order?.items?.filter((item: any) => {
    const cat = item.menuItem.category || "";
    return cat.startsWith("main") || cat.startsWith("slider");
  }) || [];
  const extrasItems = order?.items?.filter((item: any) => {
    const cat = item.menuItem.category || "";
    return cat.startsWith("add-on") || cat.startsWith("side") || cat.startsWith("drink") || cat.startsWith("dessert");
  }) || [];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#E5E5E5",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}
      >
        {/* Success Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: isPaid ? "#7C7A67" : "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "2.5rem",
            color: isPaid ? "white" : "inherit",
          }}
        >
          {isPaid ? "✓" : "⏳"}
        </div>

        <h1
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: "1.8rem",
            color: "#111",
          }}
        >
          {isPaid ? t("title") : t("thankYou")}
        </h1>

        <p
          style={{
            color: "#666",
            marginBottom: 24,
            fontSize: "1rem",
          }}
        >
          {isPaid
            ? t("paidStatus")
            : t("thankYou")}
        </p>

        {/* Order QR Code Section - For Check-In at Location */}
        {order?.orderQrCode && !order?.arrivedAt && (
          <div
            style={{
              background: "#7C7A67",
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🎫</div>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: "1.3rem", color: "white" }}>
              Your Order QR Code
            </h3>
            <p style={{ fontSize: "0.9rem", marginBottom: 16, color: "rgba(255,255,255,0.9)" }}>
              Scan this at the kiosk when you arrive to get your pod assignment
            </p>

            {/* QR Code Display */}
            <div
              style={{
                background: "white",
                padding: 20,
                borderRadius: 12,
                marginBottom: 16,
                display: "inline-block",
              }}
            >
              <QRCodeSVG
                value={order.orderQrCode}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Order Code Text */}
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.8)",
                marginBottom: 12,
                letterSpacing: "0.5px",
              }}
            >
              {order.orderQrCode}
            </div>

            {/* Arrival Time */}
            {order.estimatedArrival && (
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)", marginTop: 12, marginBottom: 16 }}>
                Expected arrival: {new Date(order.estimatedArrival).toLocaleTimeString()}
              </p>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <button
                onClick={() =>
                  router.push(
                    `/order/check-in?orderQrCode=${encodeURIComponent(
                      order.orderQrCode
                    )}`
                  )
                }
                style={{
                  width: "100%",
                  padding: 12,
                  background: "white",
                  color: "#7C7A67",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {t("simulateCheckIn")}
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/order/status?orderQrCode=${encodeURIComponent(
                      order.orderQrCode
                    )}`
                  )
                }
                style={{
                  width: "100%",
                  padding: 12,
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "2px solid white",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {t("viewStatus")}
              </button>
            </div>
          </div>
        )}

        {/* Pod Assignment Section - TODO: Re-implement with better UX later */}
        {/* Removed for now - will be added back with improved pod management */}

        {/* Group Orders Section - Show all orders in the group */}
        {groupOrders.length > 1 && (
          <div
            style={{
              background: "#f0fdf4",
              border: "2px solid #22c55e",
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 8, textAlign: "center" }}>👥</div>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: "1.2rem", textAlign: "center", color: "#166534" }}>
              {tGroup("groupOrders")} ({groupOrders.length})
            </h3>

            <div style={{ display: "grid", gap: 12 }}>
              {groupOrders.map((groupOrder, idx) => (
                <div
                  key={groupOrder.id}
                  style={{
                    background: "white",
                    borderRadius: 8,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>
                      {groupOrder.isGroupHost ? "Host" : `Guest ${idx}`}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>
                      {groupOrder.seat ? `Pod ${groupOrder.seat.number}` : "No pod yet"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 12 }}>
                    {groupOrder.user?.name || groupOrder.guest?.name || `Order #${groupOrder.orderNumber.slice(-6)}`}
                    {" • "}${(groupOrder.totalCents / 100).toFixed(2)}
                  </div>

                  {/* Check-in button for orders without pod or not confirmed */}
                  {!groupOrder.arrivedAt && groupOrder.orderQrCode && (
                    <button
                      onClick={() =>
                        router.push(
                          `/order/check-in?orderQrCode=${encodeURIComponent(groupOrder.orderQrCode)}`
                        )
                      }
                      style={{
                        width: "100%",
                        padding: 10,
                        background: "#166534",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Check In This Order
                    </button>
                  )}

                  {groupOrder.arrivedAt && !groupOrder.podConfirmedAt && groupOrder.seat && (
                    <div style={{ fontSize: "0.85rem", color: "#166534", textAlign: "center", padding: 8 }}>
                      Assigned to Pod {groupOrder.seat.number} - awaiting arrival
                    </div>
                  )}

                  {groupOrder.podConfirmedAt && (
                    <div style={{ fontSize: "0.85rem", color: "#166534", textAlign: "center", padding: 8 }}>
                      Checked in at Pod {groupOrder.seat?.number}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Check In All button */}
            {groupOrders.some(o => !o.arrivedAt && o.orderQrCode) && (
              <button
                onClick={async () => {
                  for (const o of groupOrders) {
                    if (!o.arrivedAt && o.orderQrCode) {
                      try {
                        await fetch(`${BASE}/orders/check-in`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "x-tenant-slug": "oh",
                          },
                          body: JSON.stringify({ orderQrCode: o.orderQrCode }),
                        });
                      } catch (err) {
                        console.error("Failed to check in order:", err);
                      }
                    }
                  }
                  // Refresh the page to show updated status
                  window.location.reload();
                }}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: 14,
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {tGroup("checkInAll")}
              </button>
            )}
          </div>
        )}

        {/* Order Summary */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          {/* The Bowl - Step 1 & 2 items */}
          {bowlItems.length > 0 && (
            <div style={{ marginBottom: extrasItems.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                {tStatus("sections.theBowl")}
              </div>
              <div
                style={{
                  background: "rgba(124, 122, 103, 0.08)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                {bowlItems.map((item: any) => (
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

          {/* Extras - Step 3 & 4 items */}
          {extrasItems.length > 0 && (
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                {tStatus("sections.addOnsExtras")}
              </div>
              <div
                style={{
                  background: "rgba(199, 168, 120, 0.1)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                {extrasItems.map((item: any) => (
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              marginTop: 8,
            }}
          >
            <span style={{ color: "#666" }}>Order</span>
            <span>#{orderNumber}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #e5e7eb",
              fontWeight: "bold",
            }}
          >
            <span>Total</span>
            <span style={{ color: "#7C7A67" }}>
              ${totalAmount}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gap: 12 }}>
          {order?.orderQrCode && (
            <button
              onClick={() =>
                router.push(
                  `/order/status?orderQrCode=${encodeURIComponent(
                    order.orderQrCode
                  )}`
                )
              }
              style={{
                width: "100%",
                padding: 14,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              📍 Track Order Status
            </button>
          )}

          <button
            onClick={() => router.push("/member")}
            style={{
              width: "100%",
              padding: 14,
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {tStatus("buttons.viewProfile")}
          </button>

          <button
            onClick={() => router.push("/order")}
            style={{
              width: "100%",
              padding: 14,
              background: "white",
              color: "#7C7A67",
              border: "2px solid #7C7A67",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {tStatus("buttons.orderAgain")}
          </button>

          {/* Social Sharing Section */}
          <div
            style={{
              background: "rgba(124, 122, 103, 0.1)",
              border: "2px solid #7C7A67",
              borderRadius: 12,
              padding: 20,
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 8, textAlign: "center" }}>🎉</div>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: "1.1rem", textAlign: "center" }}>
              Share Your Order!
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#666",
                marginBottom: 16,
                margin: 0,
                textAlign: "center",
              }}
            >
              Spread the word and earn rewards
            </p>

            {/* Share Buttons */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => handleShare("twitter")}
                style={{
                  padding: 12,
                  background: "#1DA1F2",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>𝕏</span>
                Twitter
              </button>

              <button
                onClick={() => handleShare("facebook")}
                style={{
                  padding: 12,
                  background: "#1877F2",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>f</span>
                Facebook
              </button>

              <button
                onClick={() => handleShare("linkedin")}
                style={{
                  padding: 12,
                  background: "#0A66C2",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>in</span>
                LinkedIn
              </button>

              <button
                onClick={() => handleShare("copy")}
                style={{
                  padding: 12,
                  background: copied ? "#22c55e" : "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{copied ? "✓" : "📋"}</span>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Native Share Button (Mobile) */}
            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>📤</span>
                Share via...
              </button>
            )}

            <p
              style={{
                fontSize: "0.75rem",
                color: "#666",
                marginTop: 12,
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              💡 Your referral link is included! Friends get $5 off their first order.
              You earn $5 when they order $20+ (credited on the 1st or 16th).
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: 14,
              background: "transparent",
              color: "#666",
              border: "none",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E5E5E5",
          }}
        >
          <div style={{ color: "#222222", fontSize: "1.2rem" }}>Loading order...</div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
