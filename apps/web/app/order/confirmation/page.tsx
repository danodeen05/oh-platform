export default function ConfirmationPage({ searchParams }: any) {
  const orderNumber = searchParams.orderNumber || "UNKNOWN";
  const total = searchParams.total ? parseInt(searchParams.total) : 0;
  const isPaid = searchParams.paid === "true";

  const containerStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    textAlign: "center" as const,
  };

  return (
    <main style={containerStyle}>
      <div style={{ maxWidth: 500 }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>
          {isPaid ? "✓" : "📋"}
        </div>
        <h1 style={{ color: isPaid ? "#22c55e" : "#667eea", marginBottom: 16 }}>
          {isPaid ? "Payment Successful!" : "Order Placed!"}
        </h1>

        <div
          style={{
            background: "#f9fafb",
            padding: 24,
            borderRadius: 12,
            marginBottom: 32,
          }}
        >
          <p style={{ color: "#666", margin: 0, marginBottom: 8 }}>
            Order Number
          </p>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              margin: 0,
              marginBottom: 16,
            }}
          >
            {orderNumber}
          </p>
          <p style={{ color: "#666", margin: 0, marginBottom: 8 }}>Total</p>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              margin: 0,
              color: "#667eea",
            }}
          >
            ${(total / 100).toFixed(2)}
          </p>
        </div>

        <p style={{ color: "#666", marginBottom: 24 }}>
          {isPaid
            ? "Your order is being prepared!"
            : "Complete payment to confirm."}
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <a
            href="/order"
            style={{
              padding: "12px 24px",
              background: "#667eea",
              color: "white",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: "bold",
            }}
          >
            Order Again
          </a>
          <a
            href="/"
            style={{
              padding: "12px 24px",
              border: "2px solid #667eea",
              color: "#667eea",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: "bold",
            }}
          >
            Home
          </a>
        </div>
      </div>
    </main>
  );
}
