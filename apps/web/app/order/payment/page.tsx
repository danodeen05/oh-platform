import PaymentForm from "./payment-form";

async function getOrder(orderId: string) {
  const base = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${base}/orders/${orderId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: { orderId?: string; orderNumber?: string; total?: string };
}) {
  const orderId = searchParams.orderId;
  const orderNumber = searchParams.orderNumber || "UNKNOWN";
  const total = searchParams.total ? parseInt(searchParams.total) : 0;

  if (!orderId) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Invalid Order</h1>
        <a href="/order" style={{ color: "#667eea" }}>
          ← Back to order
        </a>
      </main>
    );
  }

  const order = await getOrder(orderId);

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Complete Your Order</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Order #{orderNumber}</p>

      {order && (
        <div
          style={{
            background: "#f9fafb",
            padding: 24,
            borderRadius: 12,
            marginBottom: 32,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 16 }}>Order Summary</h3>

          {order.items.map((item: any) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: "0.9rem",
              }}
            >
              <span>
                {item.quantity}x {item.menuItem.name}
              </span>
              <span>
                ${((item.priceCents * item.quantity) / 100).toFixed(2)}
              </span>
            </div>
          ))}

          {order.estimatedArrival && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #e5e7eb",
                fontSize: "0.9rem",
                color: "#666",
              }}
            >
              <strong>Estimated arrival:</strong>{" "}
              {new Date(order.estimatedArrival).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              marginTop: 12,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "1.2rem",
            }}
          >
            <span>Total:</span>
            <span style={{ color: "#667eea" }}>
              ${(total / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <PaymentForm
        orderId={orderId}
        totalCents={total}
        orderNumber={orderNumber}
      />
    </main>
  );
}
