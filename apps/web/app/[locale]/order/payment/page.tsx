import PaymentForm from "./payment-form";

async function getOrder(orderId: string) {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${base}/orders/${orderId}`, {
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
  const params = await searchParams;
  const orderId = params.orderId;
  const orderNumber = params.orderNumber;

  if (!orderId || !orderNumber) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Invalid Order</h1>
        <p>Missing order information</p>
        <a href="/order">← Start a new order</a>
      </main>
    );
  }

  const order = await getOrder(orderId);

  if (!order) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Order Not Found</h1>
        <p>We couldn't find this order</p>
        <a href="/order">← Start a new order</a>
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
        <h1 style={{ margin: 0, marginBottom: 8 }}>Complete Your Order</h1>
        <p style={{ color: "#666", marginBottom: 24 }}>Order #{orderNumber}</p>

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
                The Bowl
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
                Add-ons & Extras
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
              <span>Ready by</span>
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
            <span>Total</span>
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
