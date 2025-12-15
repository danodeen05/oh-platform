import { API_URL } from "@/lib/api";
import GroupPaymentForm from "./group-payment-form";

async function getGroupOrder(code: string) {
  try {
    const res = await fetch(`${API_URL}/group-orders/${code}`, {
      cache: "no-store",
      headers: { "x-tenant-slug": "oh" },
    });

    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error("Error fetching group:", error);
    return null;
  }
}

export default async function GroupPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ groupCode?: string; seatingOption?: string }>;
}) {
  const params = await searchParams;
  const groupCode = params.groupCode;
  const seatingOption = params.seatingOption ? parseInt(params.seatingOption) : null;

  if (!groupCode) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Invalid Group</h1>
        <p>Missing group code</p>
        <a href="/order">Start a new order</a>
      </main>
    );
  }

  const group = await getGroupOrder(groupCode);

  if (!group) {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Group Not Found</h1>
        <p>The group code "{groupCode}" doesn't exist or has expired.</p>
        <a href="/order">Start a new order</a>
      </main>
    );
  }

  if (group.paymentMethod !== "HOST_PAYS_ALL") {
    return (
      <main style={{ padding: 24, textAlign: "center" }}>
        <h1>Invalid Payment Method</h1>
        <p>This group is set to "Pay Your Own" - each member pays individually.</p>
        <a href={`/group/${groupCode}`}>Return to Group</a>
      </main>
    );
  }

  const totalCents = group.orders.reduce(
    (sum: number, order: any) => sum + order.totalCents,
    0
  );

  // Find the host's order for confirmation page redirect
  const hostOrder = group.orders.find((o: any) => o.isGroupHost) || group.orders[0];

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
          maxWidth: 600,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: "2rem" }}>👥</span>
          <h1 style={{ margin: "8px 0 4px" }}>Pay for Group</h1>
          <p style={{ color: "#666" }}>
            Group Code: <strong>{group.code}</strong> at {group.location.name}
          </p>
        </div>

        {/* Group Orders Summary */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 12,
              color: "#7C7A67",
            }}
          >
            {group.orders.length} Orders
          </div>

          {group.orders.map((order: any, idx: number) => (
            <div
              key={order.id}
              style={{
                padding: "12px",
                background: "white",
                borderRadius: 8,
                marginBottom: idx < group.orders.length - 1 ? 8 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {order.isGroupHost ? "Host" : `Guest ${idx}`}
                  <span style={{ color: "#9ca3af", marginLeft: 8, fontSize: "0.85rem" }}>
                    #{order.orderNumber}
                  </span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  ${(order.totalCents / 100).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                {order.items.length} items
              </div>
            </div>
          ))}

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
            <span>Group Total</span>
            <span style={{ color: "#7C7A67" }}>
              ${(totalCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <GroupPaymentForm
          groupCode={group.code}
          totalCents={totalCents}
          orderIds={group.orders.map((o: any) => o.id)}
          seatingOption={seatingOption}
          locationId={group.locationId}
          hostOrderId={hostOrder.id}
          hostOrderNumber={hostOrder.orderNumber}
        />
      </div>
    </main>
  );
}
