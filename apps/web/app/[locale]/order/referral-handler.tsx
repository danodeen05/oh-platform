"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ReferralHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    console.log("=== ReferralHandler useEffect ran ===");
    console.log("URL search params:", window.location.search);
    console.log("Ref parameter:", ref);

    if (ref) {
      console.log("✅ ReferralHandler: Storing referral code from URL:", ref);
      localStorage.setItem("pendingReferralCode", ref);
      console.log("✅ Stored in localStorage. Verify:", localStorage.getItem("pendingReferralCode"));
    } else {
      const existing = localStorage.getItem("pendingReferralCode");
      if (existing) {
        console.log("✅ ReferralHandler: Found existing referral code:", existing);
      } else {
        console.log("⚠️ ReferralHandler: No referral code in URL or localStorage");
      }
    }
  }, [searchParams]);

  return null; // This component doesn't render anything
}
