"use client";

/**
 * The visitor's in-progress order (Task C4). Extracted from the legacy
 * ActiveOrderBanner so the banner and the site shell's ActiveOrderPill share
 * one data source: the order QR code kept in localStorage after checkout,
 * checked against GET /orders/status and re-polled every 30 seconds.
 * Behavior is unchanged from the banner's original inline effect.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STORAGE_KEY = "activeOrderQrCode";
const POLL_MS = 30_000;

export interface ActiveOrder {
  orderQrCode: string;
  status: string;
  podNumber: string | null;
  kitchenOrderNumber: string | null;
}

/** Order flow pages already show the order, so the prompt hides there. */
export function isOrderFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/order/status") ||
    pathname.includes("/order/confirmation") ||
    pathname.includes("/order/scan") ||
    pathname.includes("/order/check-in") ||
    pathname.includes("/pod")
  );
}

export type ActiveOrderStatusKey = "placed" | "inQueue" | "checkedIn" | "preparing" | "ready" | "serving" | "active";

/** Translation key for an order status (site.shell.orderStatus.<key>). */
export function activeOrderStatusKey(order: Pick<ActiveOrder, "status" | "podNumber">): ActiveOrderStatusKey {
  switch (order.status) {
    case "PAID":
      return "placed";
    case "QUEUED":
      return order.podNumber ? "checkedIn" : "inQueue";
    case "PREPPING":
      return "preparing";
    case "READY":
      return "ready";
    case "SERVING":
      return "serving";
    default:
      return "active";
  }
}

export function useActiveOrder(): ActiveOrder | null {
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Check localStorage for active order
    const storedOrderQrCode = localStorage.getItem(STORAGE_KEY);
    if (!storedOrderQrCode) {
      setActiveOrder(null);
      return;
    }

    // Fetch order status to see if it's still active
    async function checkOrderStatus() {
      try {
        const response = await fetch(`${BASE}/orders/status?orderQrCode=${encodeURIComponent(storedOrderQrCode!)}`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (response.ok) {
          const data = await response.json();
          const order = data.order;

          // If order is completed, clear it from localStorage
          if (order.status === "COMPLETED") {
            localStorage.removeItem(STORAGE_KEY);
            setActiveOrder(null);
            return;
          }

          setActiveOrder({
            orderQrCode: storedOrderQrCode!,
            status: order.status,
            podNumber: order.podNumber,
            kitchenOrderNumber: order.kitchenOrderNumber,
          });
        } else {
          // Order not found, clear localStorage
          localStorage.removeItem(STORAGE_KEY);
          setActiveOrder(null);
        }
      } catch (err) {
        console.error("Failed to check order status:", err);
      }
    }

    checkOrderStatus();

    // Poll every 30 seconds to keep status updated
    const interval = setInterval(checkOrderStatus, POLL_MS);
    return () => clearInterval(interval);
  }, [pathname]);

  return activeOrder;
}
