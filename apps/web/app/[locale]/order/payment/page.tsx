import PaymentForm from "./payment-form";
import { API_URL } from "@/lib/api";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";

async function getOrder(orderId: string, locale: string) {
  const res = await fetch(`${API_URL}/orders/${orderId}?locale=${locale}`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    orderId?: string;
    orderNumber?: string;
    total?: string;
  }>;
}) {
  const t = await getTranslations("payment");
  const locale = await getLocale();
  const params = await searchParams;
  const orderId = params.orderId;
  const orderNumber = params.orderNumber;

  if (!orderId || !orderNumber) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>{t("invalidOrder")}</h1>
        <p>{t("missingInformation")}</p>
        <a href="/order">← {t("startNewOrder")}</a>
      </main>
    );
  }

  const order = await getOrder(orderId, locale);

  if (!order) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>{t("orderNotFound")}</h1>
        <p>{t("couldNotFind")}</p>
        <a href="/order">← {t("startNewOrder")}</a>
      </main>
    );
  }

  // Get total from the order data, not from URL param
  const totalCents = order.totalCents;

  // Group items by category: Bowl (main, slider) vs Extras (add-on, side, drink, dessert)
  const bowlItems = order.items.filter((item: any) => {
    const cat = item.menuItem.category || "";
    return cat.startsWith("main") || cat.startsWith("slider");
  });
  const extrasItems = order.items.filter((item: any) => {
    const cat = item.menuItem.category || "";
    return cat.startsWith("add-on") || cat.startsWith("side") || cat.startsWith("drink") || cat.startsWith("dessert");
  });

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
        }}
      >
        {/* Header with Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h1 style={{ margin: 0 }}>{t("pageTitle")}</h1>
          <Image
            src="/Oh_Logo_Mark_Web.png"
            alt="Oh! Beef Noodle Soup"
            width={60}
            height={60}
            style={{ objectFit: "contain" }}
          />
        </div>
        <p style={{ color: "#666", marginBottom: 24 }}>{t("orderNumber", { number: orderNumber })}</p>

        {/* Order Summary */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          {/* The Bowl - Step 1 & 2 items */}
          {bowlItems.length > 0 && (
            <div style={{ marginBottom: extrasItems.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#7C7A67", marginBottom: 6 }}>
                {t("theBowl")}
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
                        ({item.selectedValue || t("qty", { count: item.quantity })})
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
                {t("addOnsExtras")}
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
                        ({t("qty", { count: item.quantity })})
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

          {order.estimatedArrival && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.85rem",
                color: "#666",
                marginTop: 8,
              }}
            >
              <span>{t("readyBy")}</span>
              <span>
                {new Date(order.estimatedArrival).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid #e5e7eb",
              fontSize: "1.1rem",
              fontWeight: "bold",
            }}
          >
            <span>{t("total")}</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <PaymentForm
          orderId={orderId}
          totalCents={totalCents}
          orderNumber={orderNumber}
        />
      </div>
    </main>
  );
}
