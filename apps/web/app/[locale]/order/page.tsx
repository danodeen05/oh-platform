import { Suspense } from "react";
import LocationSelector from "./location-selector";
import ReferralHandler from "./referral-handler";
import AuthGate from "./auth-gate";
import GroupJoinBanner from "./group-join-banner";
import { API_URL } from "@/lib/api";

async function getLocations() {
  const res = await fetch(`${API_URL}/locations`, {
    cache: "no-store",
    headers: { "x-tenant-slug": "oh" },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; group?: string }>;
}) {
  const locations = await getLocations();
  const params = await searchParams;
  const referralCode = params.ref;
  const groupMode = params.group === "true";

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <ReferralHandler />
      </Suspense>

      <AuthGate>
        {/* Group Join Banner */}
        <GroupJoinBanner />

        <h1 style={{ marginBottom: 8 }}>Choose Your Location</h1>
        <p style={{ color: "#666", marginBottom: 32 }}>
          Select a location to view the menu and current wait time
          {referralCode && (
            <span style={{ color: "#22c55e", fontWeight: "bold", marginLeft: 8 }}>
              • $5 referral discount will be applied!
            </span>
          )}
        </p>

        <LocationSelector
          locations={locations}
          referralCode={referralCode}
          groupMode={groupMode}
        />
      </AuthGate>
    </main>
  );
}
