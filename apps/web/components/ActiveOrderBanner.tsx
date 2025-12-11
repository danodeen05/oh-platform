"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ActiveOrder {
  orderQrCode: string;
  status: string;
  podNumber: string | null;
  kitchenOrderNumber: string | null;
}

export default function ActiveOrderBanner() {
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on order status page or order flow pages
  const isOrderPage = pathname?.startsWith("/order/status") ||
                      pathname?.startsWith("/order/confirmation") ||
                      pathname?.startsWith("/order/scan") ||
                      pathname?.startsWith("/order/check-in") ||
                      pathname?.startsWith("/pod");

  useEffect(() => {
    // Check localStorage for active order
    const storedOrderQrCode = localStorage.getItem("activeOrderQrCode");
    if (!storedOrderQrCode) {
      setActiveOrder(null);
      return;
    }

    // Fetch order status to see if it's still active
    async function checkOrderStatus() {
      try {
        const response = await fetch(
          `${BASE}/orders/status?orderQrCode=${encodeURIComponent(storedOrderQrCode)}`,
          {
            headers: { "x-tenant-slug": "oh" },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const order = data.order;

          // If order is completed, clear it from localStorage
          if (order.status === "COMPLETED") {
            localStorage.removeItem("activeOrderQrCode");
            setActiveOrder(null);
            return;
          }

          // Otherwise, show the banner
          setActiveOrder({
            orderQrCode: storedOrderQrCode,
            status: order.status,
            podNumber: order.podNumber,
            kitchenOrderNumber: order.kitchenOrderNumber,
          });
        } else {
          // Order not found, clear localStorage
          localStorage.removeItem("activeOrderQrCode");
          setActiveOrder(null);
        }
      } catch (err) {
        console.error("Failed to check order status:", err);
      }
    }

    checkOrderStatus();

    // Poll every 30 seconds to keep status updated
    const interval = setInterval(checkOrderStatus, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Don't render if no active order, dismissed, or on order pages
  if (!activeOrder || dismissed || isOrderPage) {
    return null;
  }

  const getStatusText = () => {
    switch (activeOrder.status) {
      case "PAID":
        return "Order placed";
      case "QUEUED":
        return activeOrder.podNumber ? "Checked in" : "In queue";
      case "PREPPING":
        return "Being prepared";
      case "READY":
        return "Quality check";
      case "SERVING":
        return "Enjoy your meal!";
      default:
        return activeOrder.status;
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
        color: "white",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          flex: 1,
        }}
        onClick={() =>
          router.push(
            `/order/status?orderQrCode=${encodeURIComponent(activeOrder.orderQrCode)}`
          )
        }
      >
        <div style={{ fontSize: "1.5rem" }}>🍜</div>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            Order #{activeOrder.kitchenOrderNumber || "Active"}{" "}
            {activeOrder.podNumber && `• Pod ${activeOrder.podNumber}`}
          </div>
          <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
            {getStatusText()} — Tap to view status
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          borderRadius: "50%",
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          fontSize: "1rem",
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
