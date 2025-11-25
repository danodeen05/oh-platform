import ReferralDashboard from "./referral-dashboard";

export default function ReferralPage() {
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ marginBottom: 8 }}>Invite Friends, Earn Rewards</h1>
        <p style={{ color: "#666", fontSize: "1.1rem" }}>
          Give $5, Get $5 for every friend who orders
        </p>
      </div>

      <ReferralDashboard />

      <div
        style={{
          marginTop: 64,
          padding: 32,
          background: "#f9fafb",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginBottom: 16 }}>How It Works</h2>
        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#667eea",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                Share Your Link
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                Send your unique referral link to friends
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#667eea",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                They Get $5 Off
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                Your friend gets $5 off their first order
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#667eea",
                color: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>
                You Earn $5
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                When they place their first order, you get $5 in credits
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
