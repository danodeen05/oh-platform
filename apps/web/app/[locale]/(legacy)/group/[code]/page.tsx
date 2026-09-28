import { API_URL } from "@/lib/api";
import GroupLobby from "./group-lobby";

async function getGroupOrder(code: string) {
  try {
    const res = await fetch(`${API_URL}/group-orders/${code}`, {
      cache: "no-store",
      headers: { "x-tenant-slug": "oh" },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to fetch group order");
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching group:", error);
    return null;
  }
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const groupOrder = await getGroupOrder(code.toUpperCase());

  if (!groupOrder) {
    return (
      <main style={{ padding: 24, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: 24 }}>🔍</div>
        <h1 style={{ marginBottom: 16 }}>Group Not Found</h1>
        <p style={{ color: "#666", marginBottom: 32 }}>
          The group code "{code.toUpperCase()}" doesn't exist or has expired.
        </p>
        <a
          href="/order"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#7C7A67",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Start New Order
        </a>
      </main>
    );
  }

  return <GroupLobby initialGroup={groupOrder} />;
}
