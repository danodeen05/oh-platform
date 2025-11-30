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
  const totalCents = params.total ? parseInt(params.total) : 0;

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

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            padding: 20,
            marginBottom: 24,
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
                paddingBottom: 8,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>{item.menuItem.name}</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Qty: {item.quantity}
                </div>
              </div>
              <div style={{ fontWeight: "bold" }}>
                ${((item.priceCents * item.quantity) / 100).toFixed(2)}
              </div>
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
              <strong>Estimated Ready Time:</strong>
              <br />
              {new Date(order.estimatedArrival).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 16,
              paddingTop: 16,
              borderTop: "2px solid #e5e7eb",
              fontSize: "1.2rem",
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
