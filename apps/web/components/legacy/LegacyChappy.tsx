"use client";

import { ChappyLauncher, ChappyProvider } from "@/components/site/chappy/ChappyLauncher";

// Chappy on the pre-overhaul pages (Task E1): the same widget as the site
// shell's (one Chappy site-wide), opened from a floating launcher because
// these pages have no dock. The widget chunk loads on the first tap.
export function LegacyChappy() {
  return (
    <ChappyProvider>
      <ChappyLauncher />
    </ChappyProvider>
  );
}
