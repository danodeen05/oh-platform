import ReferralDashboard from "./referral-dashboard";

export default function ReferralPage() {
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ marginBottom: 8 }}>Invite Friends, Earn Rewards</h1>
        <p style={{ color: "#666", fontSize: "1.1rem" }}>
          Give $5, Get $5 for every friend who orders $20+
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
                background: "#7C7A67",
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
                background: "#7C7A67",
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
                They Get $5 Off Instantly
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                Your friend gets $5 off their first order right away
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                fontSize: "2rem",
                width: 48,
                height: 48,
                background: "#7C7A67",
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
                You Earn $5 (On the 1st or 16th)
              </strong>
              <p style={{ margin: 0, color: "#666" }}>
                When they place a first order of $20 or more, you earn $5 in credits.
                Referral credits are added to your account on the 1st and 16th of each month.
              </p>
            </div>
          </div>
        </div>

        {/* Fine Print */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "rgba(124, 122, 103, 0.1)",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          <strong style={{ color: "#222" }}>Good to know:</strong>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
            <li>Your friend's first order must be $20 or more for you to earn the referral bonus</li>
            <li>Referral credits are disbursed on the 1st and 16th of each month</li>
            <li>You can apply up to $5 in credits per order</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
